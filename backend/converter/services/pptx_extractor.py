import io
import os
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.shapes.picture import Picture
from PIL import Image

from ..config import EXTRACTED_MEDIA_DIR
from ..models.schemas import (
    PresentationData,
    ExtractedSlide,
    BulletPoint,
    TableData,
    VisualElement,
)


class PPTXExtractor:
    """
    Deep extraction service for PowerPoint presentations using python-pptx.
    Extracts native text, hierarchical bullets, tables, diagrams/shapes, images, and notes.
    """

    def __init__(self, media_dir: Optional[Path] = None):
        self.media_dir = media_dir or EXTRACTED_MEDIA_DIR
        self.media_dir.mkdir(parents=True, exist_ok=True)

    def extract(self, pptx_path: str | Path) -> PresentationData:
        pptx_path = Path(pptx_path)
        prs = Presentation(str(pptx_path))
        slides_data: List[ExtractedSlide] = []

        for idx, slide in enumerate(prs.slides, start=1):
            slide_data = self._extract_slide(slide, idx)
            slides_data.append(slide_data)

        return PresentationData(
            filename=pptx_path.name,
            total_slides=len(slides_data),
            slides=slides_data,
        )

    def _extract_slide(self, slide, slide_number: int) -> ExtractedSlide:
        title: Optional[str] = None
        subtitle: Optional[str] = None
        raw_paragraphs: List[str] = []
        bullets: List[BulletPoint] = []
        tables: List[TableData] = []
        visual_elements: List[VisualElement] = []
        speaker_notes: Optional[str] = None

        # 1. Extract speaker notes
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()
            if notes_text:
                speaker_notes = notes_text

        # 2. Track diagram-like grouped or standalone text shapes
        diagram_texts: List[str] = []

        # 3. Process all shapes on the slide
        for shape in slide.shapes:
            # Title detection
            if shape.has_text_frame and shape == slide.shapes.title:
                title = shape.text.strip()
                continue

            # Tables
            if shape.has_table:
                table_data = self._extract_table(shape.table)
                if table_data.rows or table_data.headers:
                    tables.append(table_data)
                continue

            # Pictures & Images
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE or isinstance(shape, Picture):
                vis_elem = self._extract_image(shape, slide_number)
                if vis_elem:
                    visual_elements.append(vis_elem)
                continue

            # Grouped shapes (often architecture diagrams / flowcharts)
            if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                group_elem = self._extract_group_shape(shape, slide_number)
                if group_elem:
                    visual_elements.append(group_elem)
                continue

            # Standard Text Frames and AutoShapes (Rectangles, Flowchart symbols, etc.)
            if shape.has_text_frame:
                text_content = shape.text.strip()
                if not text_content:
                    continue

                # If slide title was not found via placeholder, check if this is the first prominent text
                if not title and (shape.shape_type == MSO_SHAPE_TYPE.TEXT_BOX or "Title" in shape.name):
                    title = text_content
                    continue

                # Check paragraphs and bullet structure
                for paragraph in shape.text_frame.paragraphs:
                    p_text = paragraph.text.strip()
                    if not p_text:
                        continue

                    raw_paragraphs.append(p_text)
                    # Detect if it's bulleted or indented
                    level = paragraph.level if hasattr(paragraph, 'level') and paragraph.level is not None else 0
                    bullets.append(BulletPoint(text=p_text, level=level))

                # If shape is a geometric shape (process node, flow box), also record as diagram node
                if shape.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE:
                    diagram_texts.append(text_content)

        # If we detected multiple auto-shapes with text but no picture, record a virtual diagram element
        if len(diagram_texts) >= 2:
            visual_elements.append(
                VisualElement(
                    element_id=f"slide_{slide_number}_vector_flow_{uuid.uuid4().hex[:6]}",
                    type="vector_flow",
                    meaningful_relationships=" -> ".join(diagram_texts),
                    vision_description=f"Slide diagram flow connecting: {', '.join(diagram_texts)}",
                )
            )

        # Fallback title if none was detected
        if not title:
            if raw_paragraphs:
                title = raw_paragraphs[0]
                raw_paragraphs = raw_paragraphs[1:]
                if bullets:
                    bullets = bullets[1:]
            else:
                title = f"Slide {slide_number}"

        return ExtractedSlide(
            slide_number=slide_number,
            title=title,
            subtitle=subtitle,
            raw_paragraphs=raw_paragraphs,
            bullets=bullets,
            tables=tables,
            visual_elements=visual_elements,
            speaker_notes=speaker_notes,
        )

    def _extract_table(self, table) -> TableData:
        matrix: List[List[str]] = []
        for row in table.rows:
            row_vals = [cell.text.strip() for cell in row.cells]
            matrix.append(row_vals)

        if not matrix:
            return TableData()

        # First row as header
        headers = matrix[0]
        rows = matrix[1:] if len(matrix) > 1 else []
        return TableData(headers=headers, rows=rows)

    def _extract_image(self, shape, slide_number: int) -> Optional[VisualElement]:
        try:
            image = shape.image
            image_bytes = image.blob
            ext = image.ext or "png"
            filename = f"slide_{slide_number}_img_{uuid.uuid4().hex[:8]}.{ext}"
            file_path = self.media_dir / filename

            with open(file_path, "wb") as f:
                f.write(image_bytes)

            # Open with Pillow to verify dimensions
            with Image.open(io.BytesIO(image_bytes)) as pil_img:
                width, height = pil_img.size

            elem_type = "image"
            # Simple heuristic: wide/tall proportions or large size often diagrams/screenshots
            if width > 400 and height > 200:
                elem_type = "diagram_or_screenshot"

            return VisualElement(
                element_id=f"img_{slide_number}_{uuid.uuid4().hex[:6]}",
                type=elem_type,
                image_path=str(file_path),
            )
        except Exception as e:
            print(f"Error extracting image on slide {slide_number}: {e}")
            return None

    def _extract_group_shape(self, group_shape, slide_number: int) -> Optional[VisualElement]:
        """Extract text nodes and connections from a grouped shape (e.g. drawn diagram)"""
        sub_texts: List[str] = []
        for shape in group_shape.shapes:
            if shape.has_text_frame and shape.text.strip():
                sub_texts.append(shape.text.strip())

        if sub_texts:
            return VisualElement(
                element_id=f"group_diagram_{slide_number}_{uuid.uuid4().hex[:6]}",
                type="diagram",
                meaningful_relationships=" -> ".join(sub_texts),
                vision_description=f"Architecture/Flowchart diagram containing components: {', '.join(sub_texts)}",
            )
        return None

import json
from typing import Optional, List, Dict, Any
from pathlib import Path

try:
    import google.generativeai as genai
except ImportError:
    genai = None

from ..config import settings
from ..models.schemas import (
    PresentationData,
    ExtractedSlide,
    DocumentStructure,
    DocumentSection,
    DocumentParagraph,
    ConversionMode,
    TableData,
    VisualElement,
)


class SemanticTransformer:
    """
    Transforms structured slide extractions and visual insights into
    a professionally written, well-organized Word document structure.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        if self.api_key and genai:
            genai.configure(api_key=self.api_key)

    def transform(
        self, presentation: PresentationData, mode: ConversionMode = ConversionMode.INTELLIGENT
    ) -> DocumentStructure:
        if self.api_key and genai:
            try:
                return self._transform_with_gemini(presentation, mode)
            except Exception as e:
                print(f"Gemini transformation failed: {e}. Falling back to deterministic transformer.")
                return self._transform_heuristically(presentation, mode)
        else:
            return self._transform_heuristically(presentation, mode)

    def _transform_with_gemini(
        self, presentation: PresentationData, mode: ConversionMode
    ) -> DocumentStructure:
        model = genai.GenerativeModel("gemini-2.0-flash")

        presentation_dict = presentation.model_dump()

        system_instruction = f"""
You are an expert AI technical writer and document architect. Your task is to convert raw PowerPoint presentation slides into a comprehensive, highly structured Word Document specification.

Conversion Mode: {mode.value.upper()}

CRITICAL RULES:
1. PRESERVE ALL ORIGINAL FACTS, NUMBERS, PERCENTAGES, METRICS, AND TECHNICAL TERMINOLOGY VERBATIM (e.g. 99.47%, ResNet50, etc.). Do NOT modify or round numbers.
2. Transform fragmented bullet points into fluent, coherent, and professional paragraphs.
3. For diagrams and flowcharts, synthesize the visual insights into clear prose explanations and dedicated callout descriptions.
4. If speaker notes exist, integrate the insights seamlessly into the section narrative.
5. Create a professional Executive Summary synthesizing the presentation.
6. Output MUST strictly be valid JSON matching this schema:

{{
  "title": "Document Title",
  "subtitle": "Subtitle or Topic",
  "executive_summary": "Synthesized executive overview...",
  "sections": [
    {{
      "slide_number": 1,
      "section_title": "Section Title",
      "paragraphs": [
        {{
          "type": "heading_2 | heading_3 | body | bullet | callout_insight | diagram_analysis",
          "text": "Content text here...",
          "level": 0
        }}
      ],
      "diagram_callouts": ["Callout description for any diagram or workflow..."]
    }}
  ]
}}
"""

        prompt = f"""
{system_instruction}

Here is the extracted presentation data:
{json.dumps(presentation_dict, indent=2)}

Generate the JSON document structure now:
"""

        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )

        content = response.text.strip()
        data = json.loads(content)

        # Merge original tables and visual elements back into sections
        sections: List[DocumentSection] = []
        for sec_data in data.get("sections", []):
            s_num = sec_data.get("slide_number", 1)
            orig_slide = next((s for s in presentation.slides if s.slide_number == s_num), None)

            paragraphs = [
                DocumentParagraph(**p) for p in sec_data.get("paragraphs", [])
            ]
            tables = orig_slide.tables if orig_slide else []
            visuals = orig_slide.visual_elements if orig_slide else []

            sections.append(
                DocumentSection(
                    slide_number=s_num,
                    section_title=sec_data.get("section_title", f"Section {s_num}"),
                    paragraphs=paragraphs,
                    tables=tables,
                    visual_elements=visuals,
                    diagram_callouts=sec_data.get("diagram_callouts", []),
                )
            )

        return DocumentStructure(
            title=data.get("title", presentation.filename.replace(".pptx", "")),
            subtitle=data.get("subtitle", "Technical Presentation Report"),
            executive_summary=data.get("executive_summary"),
            sections=sections,
            conversion_mode=mode,
        )

    def _transform_heuristically(
        self, presentation: PresentationData, mode: ConversionMode
    ) -> DocumentStructure:
        """Deterministic high-quality transformer when running offline or without API key"""
        doc_title = presentation.slides[0].title if presentation.slides else presentation.filename.replace(".pptx", "")
        doc_subtitle = presentation.slides[0].subtitle or "Automated Presentation Report"
        
        # Build Executive Summary from notes and first few slides
        exec_summary_points = []
        for slide in presentation.slides[:3]:
            if slide.title and slide.title != doc_title:
                exec_summary_points.append(f"• {slide.title}")
            for b in slide.bullets[:2]:
                exec_summary_points.append(f"  - {b.text}")
        
        exec_summary = (
            f"This document presents a structured synthesis of the '{doc_title}' presentation. "
            f"Key focus areas include:\n" + "\n".join(exec_summary_points)
            if exec_summary_points else f"A synthesized report compiled from {presentation.total_slides} slides."
        )

        sections: List[DocumentSection] = []

        for slide in presentation.slides:
            sec_title = slide.title or f"Slide {slide.slide_number}"
            paragraphs: List[DocumentParagraph] = []
            callouts: List[str] = []

            # 1. Process diagrams & visual descriptions
            for vis in slide.visual_elements:
                if vis.meaningful_relationships:
                    callouts.append(f"Process Flow: {vis.meaningful_relationships}")
                if vis.vision_description:
                    paragraphs.append(
                        DocumentParagraph(
                            type="diagram_analysis",
                            text=f"Visual Analysis: {vis.vision_description}",
                        )
                    )
                if vis.ocr_text:
                    paragraphs.append(
                        DocumentParagraph(
                            type="callout_insight",
                            text=f"Extracted Image Data: {vis.ocr_text}",
                        )
                    )

            # 2. Process bullet points according to mode
            if mode == ConversionMode.INTELLIGENT and slide.bullets:
                # Combine related bullets into coherent narrative paragraphs
                bullet_texts = [b.text for b in slide.bullets]
                coherent_narrative = " ".join(
                    b if b.endswith(('.', '!', '?')) else b + "." for b in bullet_texts
                )
                paragraphs.append(
                    DocumentParagraph(
                        type="body",
                        text=coherent_narrative,
                    )
                )
                # Keep distinct sub-bullets if indented
                for b in slide.bullets:
                    if b.level > 0:
                        paragraphs.append(
                            DocumentParagraph(type="bullet", text=b.text, level=b.level)
                        )
            else:
                # Faithful mode: retain bullet structure
                for b in slide.bullets:
                    paragraphs.append(
                        DocumentParagraph(type="bullet", text=b.text, level=b.level)
                    )

            # 3. Process raw paragraphs if not covered by bullets
            for p in slide.raw_paragraphs:
                if not any(p == b.text for b in slide.bullets):
                    paragraphs.append(DocumentParagraph(type="body", text=p))

            # 4. Integrate speaker notes
            if slide.speaker_notes:
                paragraphs.append(
                    DocumentParagraph(
                        type="callout_insight",
                        text=f"Presenter Context: {slide.speaker_notes}",
                    )
                )

            sections.append(
                DocumentSection(
                    slide_number=slide.slide_number,
                    section_title=sec_title,
                    paragraphs=paragraphs,
                    tables=slide.tables,
                    visual_elements=slide.visual_elements,
                    diagram_callouts=callouts,
                )
            )

        return DocumentStructure(
            title=doc_title,
            subtitle=doc_subtitle,
            executive_summary=exec_summary,
            sections=sections,
            conversion_mode=mode,
        )

from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class ConversionMode(str, Enum):
    FAITHFUL = "faithful"
    INTELLIGENT = "intelligent"
    EXECUTIVE_SUMMARY = "executive_summary"


class BulletPoint(BaseModel):
    text: str
    level: int = 0


class TableData(BaseModel):
    headers: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)
    caption: Optional[str] = None


class VisualElement(BaseModel):
    element_id: str
    type: str = "image"  # diagram, chart, screenshot, photo, vector_flow
    image_path: Optional[str] = None
    ocr_text: Optional[str] = None
    vision_description: Optional[str] = None
    meaningful_relationships: Optional[str] = None
    confidence: float = 1.0


class ExtractedSlide(BaseModel):
    slide_number: int
    title: Optional[str] = None
    subtitle: Optional[str] = None
    raw_paragraphs: List[str] = Field(default_factory=list)
    bullets: List[BulletPoint] = Field(default_factory=list)
    tables: List[TableData] = Field(default_factory=list)
    visual_elements: List[VisualElement] = Field(default_factory=list)
    speaker_notes: Optional[str] = None


class PresentationData(BaseModel):
    filename: str
    total_slides: int
    slides: List[ExtractedSlide] = Field(default_factory=list)


class DocumentParagraph(BaseModel):
    type: str = "body"  # heading_1, heading_2, heading_3, body, bullet, callout_insight, diagram_analysis
    text: str
    level: int = 0


class DocumentSection(BaseModel):
    slide_number: int
    section_title: str
    paragraphs: List[DocumentParagraph] = Field(default_factory=list)
    tables: List[TableData] = Field(default_factory=list)
    visual_elements: List[VisualElement] = Field(default_factory=list)
    diagram_callouts: List[str] = Field(default_factory=list)


class DocumentStructure(BaseModel):
    title: str
    subtitle: Optional[str] = None
    executive_summary: Optional[str] = None
    sections: List[DocumentSection] = Field(default_factory=list)
    conversion_mode: ConversionMode = ConversionMode.INTELLIGENT


class ValidationMetricCheck(BaseModel):
    metric: str
    original_context: str
    generated_context: str
    status: str = "VERIFIED"  # VERIFIED, FLAGGED, MISSING
    slide_number: int
    note: Optional[str] = None


class ValidationReport(BaseModel):
    total_metrics_checked: int = 0
    verified_count: int = 0
    flagged_count: int = 0
    confidence_score: float = 100.0  # percentage
    metric_checks: List[ValidationMetricCheck] = Field(default_factory=list)
    terminology_checks: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class ConversionResponse(BaseModel):
    task_id: str
    status: str
    filename: str
    conversion_mode: str
    presentation_summary: Dict[str, Any]
    document_structure: Optional[DocumentStructure] = None
    validation_report: Optional[ValidationReport] = None
    download_url: Optional[str] = None

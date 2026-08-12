import pytest
from pathlib import Path
from backend.tests.create_sample_presentation import create_sample_presentation
from backend.services.pptx_extractor import PPTXExtractor
from backend.services.vision_analyzer import VisionAnalyzer
from backend.services.semantic_transformer import SemanticTransformer
from backend.services.validator import SemanticValidator
from backend.services.docx_generator import DocxGenerator
from backend.models.schemas import ConversionMode


def test_complete_conversion_pipeline(tmp_path):
    # 1. Create sample presentation
    sample_pptx = tmp_path / "test_sample.pptx"
    create_sample_presentation(str(sample_pptx))
    assert sample_pptx.exists()

    # 2. Extract PPTX
    media_dir = tmp_path / "media"
    extractor = PPTXExtractor(media_dir=media_dir)
    presentation_data = extractor.extract(sample_pptx)

    assert presentation_data.total_slides == 5
    assert "Clinical AI" in presentation_data.slides[0].title
    assert presentation_data.slides[0].speaker_notes is not None
    assert len(presentation_data.slides[2].tables) == 1
    assert presentation_data.slides[2].tables[0].headers[1] == "Accuracy"

    # 3. Vision Analysis
    vision_analyzer = VisionAnalyzer(api_key=None)
    for slide in presentation_data.slides:
        slide.visual_elements = vision_analyzer.analyze_slide_visuals(slide)

    # 4. Semantic Transformation
    transformer = SemanticTransformer(api_key=None)
    doc_structure = transformer.transform(presentation_data, mode=ConversionMode.INTELLIGENT)

    assert doc_structure.title is not None
    assert len(doc_structure.sections) == 5
    assert doc_structure.executive_summary is not None

    # 5. Semantic Validation
    validator = SemanticValidator()
    validation_report = validator.validate(presentation_data, doc_structure)

    assert validation_report.confidence_score >= 90.0
    assert validation_report.total_metrics_checked > 0
    # Check 99.47% is verified
    verified_metrics = [m.metric for m in validation_report.metric_checks if m.status == "VERIFIED"]
    assert any("99.47" in m for m in verified_metrics)

    # 6. DOCX Generation
    docx_dir = tmp_path / "docx_out"
    generator = DocxGenerator(output_dir=docx_dir)
    docx_path = generator.generate(doc_structure, filename="test_output")

    assert docx_path.exists()
    assert docx_path.stat().st_size > 1000  # Valid non-empty DOCX binary
    print(f"\nPipeline successfully tested! Generated DOCX size: {docx_path.stat().st_size} bytes")

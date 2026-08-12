import os
import sys
import json
import uuid
import argparse
from pathlib import Path
from typing import Optional, Dict, Any

# Add parent directory to sys.path so package imports work when executed directly
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))

from converter.config import settings, UPLOAD_DIR, OUTPUT_DIR, EXTRACTED_MEDIA_DIR
from converter.models.schemas import (
    ConversionMode,
    PresentationData,
    DocumentStructure,
    ValidationReport,
)
from converter.services.pptx_extractor import PPTXExtractor
from converter.services.vision_analyzer import VisionAnalyzer
from converter.services.semantic_transformer import SemanticTransformer
from converter.services.validator import SemanticValidator
from converter.services.docx_generator import DocxGenerator


def run_pipeline(
    input_pptx_path: str,
    output_docx_path: Optional[str] = None,
    mode_str: str = "intelligent",
    api_key: Optional[str] = None,
) -> dict:
    input_path = Path(input_pptx_path).resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_pptx_path}")

    task_id = str(uuid.uuid4())
    effective_api_key = api_key or settings.GEMINI_API_KEY

    try:
        mode = ConversionMode(mode_str.lower())
    except ValueError:
        mode = ConversionMode.INTELLIGENT

    media_dir = EXTRACTED_MEDIA_DIR / task_id
    extractor = PPTXExtractor(media_dir=media_dir)
    presentation_data = extractor.extract(input_path)

    # Vision & OCR analysis
    vision_analyzer = VisionAnalyzer(api_key=effective_api_key)
    for slide in presentation_data.slides:
        slide.visual_elements = vision_analyzer.analyze_slide_visuals(slide)

    # Semantic Transformation
    transformer = SemanticTransformer(api_key=effective_api_key)
    doc_structure = transformer.transform(presentation_data, mode=mode)

    # Validation
    validator = SemanticValidator()
    validation_report = validator.validate(presentation_data, doc_structure)

    # Word Docx Generation
    if output_docx_path:
        out_docx = Path(output_docx_path).resolve()
        generator = DocxGenerator(output_dir=out_docx.parent)
        final_docx_path = generator.generate(doc_structure, filename=out_docx.stem)
    else:
        generator = DocxGenerator(output_dir=OUTPUT_DIR)
        final_docx_path = generator.generate(
            doc_structure,
            filename=f"{task_id}_{presentation_data.filename.replace('.pptx', '')}",
        )

    result = {
        "success": True,
        "task_id": task_id,
        "filename": presentation_data.filename,
        "docx_path": str(final_docx_path),
        "conversion_mode": mode.value,
        "presentation_summary": {
            "total_slides": presentation_data.total_slides,
            "total_images": sum(len(s.visual_elements) for s in presentation_data.slides),
            "total_tables": sum(len(s.tables) for s in presentation_data.slides),
        },
        "document_structure": doc_structure.model_dump(),
        "validation_report": validation_report.model_dump(),
    }
    return result


def main():
    parser = argparse.ArgumentParser(description="PPTX to Structured DOCX Converter CLI")
    parser.add_argument("--input", required=True, help="Path to input PPTX file")
    parser.add_argument("--output", required=False, default=None, help="Path to output DOCX file")
    parser.add_argument("--mode", default="intelligent", choices=["intelligent", "faithful", "executive"], help="Conversion mode")
    parser.add_argument("--api_key", default=None, help="Gemini API Key")
    parser.add_argument("--json_out", default=None, help="Optional path to write result JSON")

    args = parser.parse_args()

    try:
        result = run_pipeline(
            input_pptx_path=args.input,
            output_docx_path=args.output,
            mode_str=args.mode,
            api_key=args.api_key,
        )

        if args.json_out:
            with open(args.json_out, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

        print("===CONVERSION_RESULT_START===")
        print(json.dumps(result))
        print("===CONVERSION_RESULT_END===")
        sys.exit(0)

    except Exception as e:
        import traceback
        err_data = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
        }
        print("===CONVERSION_RESULT_START===")
        print(json.dumps(err_data))
        print("===CONVERSION_RESULT_END===")
        sys.exit(1)


if __name__ == "__main__":
    main()

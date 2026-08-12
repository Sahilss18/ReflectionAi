import os
import uuid
import shutil
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings, UPLOAD_DIR, OUTPUT_DIR, EXTRACTED_MEDIA_DIR
from .models.schemas import (
    ConversionMode,
    ConversionResponse,
    PresentationData,
    DocumentStructure,
    ValidationReport,
)
from .services.pptx_extractor import PPTXExtractor
from .services.vision_analyzer import VisionAnalyzer
from .services.semantic_transformer import SemanticTransformer
from .services.validator import SemanticValidator
from .services.docx_generator import DocxGenerator

app = FastAPI(
    title="AI-Powered Presentation-to-Document Converter",
    description="Transforms PowerPoint presentations (.pptx) into structured, validated Word documents (.docx)",
    version="1.0.0",
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory task registry for conversion results
task_registry: Dict[str, Dict[str, Any]] = {}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "gemini_api_configured": bool(settings.GEMINI_API_KEY),
    }


@app.post("/api/convert", response_model=ConversionResponse)
async def convert_presentation(
    file: UploadFile = File(...),
    mode: ConversionMode = Form(ConversionMode.INTELLIGENT),
    api_key: Optional[str] = Form(None),
):
    if not file.filename.endswith((".pptx", ".PPTX")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload a PowerPoint (.pptx) file.",
        )

    task_id = str(uuid.uuid4())
    upload_path = UPLOAD_DIR / f"{task_id}_{file.filename}"

    # Save uploaded file
    try:
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    effective_api_key = api_key or settings.GEMINI_API_KEY

    try:
        # Step 1 & 2: Extract PPTX
        extractor = PPTXExtractor(media_dir=EXTRACTED_MEDIA_DIR / task_id)
        presentation_data = extractor.extract(upload_path)

        # Step 3, 4 & 5: Vision & OCR analysis for diagrams/visuals
        vision_analyzer = VisionAnalyzer(api_key=effective_api_key)
        for slide in presentation_data.slides:
            slide.visual_elements = vision_analyzer.analyze_slide_visuals(slide)

        # Step 6 & 7: Semantic Transformation
        transformer = SemanticTransformer(api_key=effective_api_key)
        doc_structure = transformer.transform(presentation_data, mode=mode)

        # Step 8: Semantic Fact & Number Validation
        validator = SemanticValidator()
        validation_report = validator.validate(presentation_data, doc_structure)

        # Step 9: Generate Word Document
        generator = DocxGenerator(output_dir=OUTPUT_DIR)
        out_docx_path = generator.generate(doc_structure, filename=f"{task_id}_{presentation_data.filename.replace('.pptx', '')}")

        # Store in registry
        task_registry[task_id] = {
            "task_id": task_id,
            "filename": file.filename,
            "docx_path": str(out_docx_path),
            "presentation_data": presentation_data.model_dump(),
            "doc_structure": doc_structure.model_dump(),
            "validation_report": validation_report.model_dump(),
        }

        return ConversionResponse(
            task_id=task_id,
            status="completed",
            filename=file.filename,
            conversion_mode=mode.value,
            presentation_summary={
                "total_slides": presentation_data.total_slides,
                "total_images": sum(len(s.visual_elements) for s in presentation_data.slides),
                "total_tables": sum(len(s.tables) for s in presentation_data.slides),
            },
            document_structure=doc_structure,
            validation_report=validation_report,
            download_url=f"/api/download/{task_id}",
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")


@app.get("/api/download/{task_id}")
async def download_document(task_id: str):
    task = task_registry.get(task_id)
    if not task or not Path(task["docx_path"]).exists():
        raise HTTPException(status_code=404, detail="Document not found or expired.")

    return FileResponse(
        path=task["docx_path"],
        filename=f"Converted_{task['filename'].replace('.pptx', '.docx')}",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.get("/api/report/{task_id}")
async def get_report(task_id: str):
    task = task_registry.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return JSONResponse(content=task)


@app.post("/api/generate-sample")
async def generate_sample_file():
    from .tests.create_sample_presentation import create_sample_presentation
    sample_path = UPLOAD_DIR / "sample_clinical_presentation.pptx"
    create_sample_presentation(str(sample_path))
    return FileResponse(
        path=str(sample_path),
        filename="sample_clinical_presentation.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
    )

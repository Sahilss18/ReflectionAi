import os
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from PIL import Image, ImageDraw, ImageFont


def create_sample_presentation(output_path: str = "sample_presentation.pptx") -> Path:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # --- Slide 1: Title Slide ---
    s1 = prs.slides.add_slide(blank_layout)
    tb1 = s1.shapes.add_textbox(Inches(1.5), Inches(2.2), Inches(10.3), Inches(3.0))
    tf1 = tb1.text_frame
    tf1.word_wrap = True
    
    p1 = tf1.paragraphs[0]
    p1.text = "Clinical AI & Machine Learning Pipeline"
    p1.font.size = Pt(40)
    p1.font.bold = True
    p1.font.color.rgb = RGBColor(15, 23, 42)

    p2 = tf1.add_paragraph()
    p2.text = "Automated Diagnostic Architecture & Real-Time Telemetry"
    p2.font.size = Pt(20)
    p2.font.color.rgb = RGBColor(71, 85, 105)

    p3 = tf1.add_paragraph()
    p3.text = "Author: AI Research Lab | Date: 2026-08-11 | Version: 2.4.0"
    p3.font.size = Pt(14)
    p3.font.color.rgb = RGBColor(100, 116, 139)

    # Speaker notes for Slide 1
    s1.notes_slide.notes_text_frame.text = "This presentation details the clinical AI diagnostic pipeline for enterprise hospital deployment."

    # --- Slide 2: Pipeline Diagram with Shapes ---
    s2 = prs.slides.add_slide(blank_layout)
    tb2 = s2.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(1.0))
    p_s2 = tb2.text_frame.paragraphs[0]
    p_s2.text = "Machine Learning Pipeline Architecture"
    p_s2.font.size = Pt(28)
    p_s2.font.bold = True

    # Process step boxes
    steps = ["1. Data Ingestion", "2. Preprocessing", "3. Feature Extraction", "4. Model Training", "5. Prediction"]
    box_w = Inches(2.0)
    box_h = Inches(1.2)
    start_x = Inches(1.0)
    spacing = Inches(2.35)
    y = Inches(2.8)

    for i, step_text in enumerate(steps):
        x = start_x + (i * spacing)
        shape = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, box_w, box_h)
        shape.fill.solid()
        shape.fill.fore_color.rgb = RGBColor(37, 99, 235)
        shape.line.color.rgb = RGBColor(29, 78, 216)
        tf = shape.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = step_text
        p.font.size = Pt(13)
        p.font.bold = True
        p.font.color.rgb = RGBColor(255, 255, 255)
        p.alignment = PP_ALIGN.CENTER

    s2.notes_slide.notes_text_frame.text = "Data flows sequentially through 5 core stages ensuring zero data leakage before clinical prediction."

    # --- Slide 3: Model Benchmark Table ---
    s3 = prs.slides.add_slide(blank_layout)
    tb3 = s3.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(1.0))
    p_s3 = tb3.text_frame.paragraphs[0]
    p_s3.text = "Diagnostic Model Performance Benchmarks"
    p_s3.font.size = Pt(28)
    p_s3.font.bold = True

    rows, cols = 4, 5
    left = Inches(1.0)
    top = Inches(2.2)
    width = Inches(11.3)
    height = Inches(3.5)

    table_shape = s3.shapes.add_table(rows, cols, left, top, width, height)
    table = table_shape.table

    table_data = [
        ["Model Architecture", "Accuracy", "Precision", "Recall", "Inference Latency"],
        ["ResNet50-Clinical", "99.47%", "99.23%", "99.33%", "12.4ms"],
        ["EfficientNet-B4", "98.85%", "98.60%", "98.90%", "18.2ms"],
        ["Vision-Transformer-Base", "99.12%", "99.05%", "99.18%", "24.6ms"],
    ]

    for r_idx, row in enumerate(table_data):
        for c_idx, val in enumerate(row):
            cell = table.cell(r_idx, c_idx)
            cell.text = val

    # --- Slide 4: Key Insights & Bullets ---
    s4 = prs.slides.add_slide(blank_layout)
    tb4_title = s4.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(1.0))
    tb4_title.text_frame.paragraphs[0].text = "Clinical Deployment Takeaways"
    tb4_title.text_frame.paragraphs[0].font.size = Pt(28)
    tb4_title.text_frame.paragraphs[0].font.bold = True

    tb4_content = s4.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.3), Inches(4.5))
    tf4 = tb4_content.text_frame
    tf4.word_wrap = True

    bullets = [
        ("ResNet50-Clinical achieved peak accuracy of 99.47% across 50,000 validation samples.", 0),
        ("Sub-15ms inference enables real-time bedside clinical telemetry integration.", 1),
        ("HIPAA-compliant data encryption guarantees zero unauthorized data egress.", 0),
        ("Automated failover guarantees 99.999% system uptime during peak emergency hours.", 1),
        ("PlantVillage and MIMIC-IV datasets were utilized for pre-training evaluation.", 0),
    ]

    for i, (b_text, b_lvl) in enumerate(bullets):
        p = tf4.paragraphs[0] if i == 0 else tf4.add_paragraph()
        p.text = b_text
        p.level = b_lvl
        p.font.size = Pt(16)

    # --- Slide 5: Embedded Diagram / Image ---
    s5 = prs.slides.add_slide(blank_layout)
    tb5 = s5.shapes.add_textbox(Inches(1.0), Inches(0.8), Inches(11.3), Inches(1.0))
    tb5.text_frame.paragraphs[0].text = "Edge Deployment Architecture Diagram"
    tb5.text_frame.paragraphs[0].font.size = Pt(28)
    tb5.text_frame.paragraphs[0].font.bold = True

    # Generate a diagram image using PIL
    img_dir = Path("backend/tests/assets")
    img_dir.mkdir(parents=True, exist_ok=True)
    img_path = img_dir / "sample_arch_diagram.png"

    img = Image.new("RGB", (900, 450), color=(248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Draw diagram boxes
    draw.rectangle([50, 160, 220, 280], fill=(224, 231, 255), outline=(79, 70, 229), width=3)
    draw.text((70, 210), "IoT Bedside Device\n(Edge Sensors)", fill=(30, 27, 75))

    draw.rectangle([350, 160, 520, 280], fill=(219, 234, 254), outline=(37, 99, 235), width=3)
    draw.text((370, 210), "FastAPI Microservice\n(Inference Hub)", fill=(30, 58, 138))

    draw.rectangle([650, 160, 820, 280], fill=(220, 252, 231), outline=(22, 163, 74), width=3)
    draw.text((670, 210), "EHR Hospital Cloud\n(Accuracy: 99.47%)", fill=(20, 83, 45))

    # Draw connecting arrows
    draw.line([220, 220, 350, 220], fill=(79, 70, 229), width=4)
    draw.polygon([(350, 220), (335, 212), (335, 228)], fill=(79, 70, 229))

    draw.line([520, 220, 650, 220], fill=(37, 99, 235), width=4)
    draw.polygon([(650, 220), (635, 212), (635, 228)], fill=(37, 99, 235))

    img.save(str(img_path))

    # Add image to slide
    s5.shapes.add_picture(str(img_path), Inches(2.0), Inches(2.2), width=Inches(8.5))

    # Save presentation
    out = Path(output_path)
    prs.save(str(out))
    print(f"Sample presentation created at: {out.resolve()}")
    return out


if __name__ == "__main__":
    create_sample_presentation("sample_clinical_presentation.pptx")

# PPT to DOCX Conversion Engine

This service converts PowerPoint presentations (`.pptx` / `.ppt`) into structured Word documents (`.docx`) and extracts visual diagrams and slide structures for the ReflectionAi presentation simulation engine.

## Setup & Running

### 1. Python Environment
```bash
cd PPT_to_PDF/backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Install dependencies:
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Ensure `.env` contains your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key
DEFAULT_MODEL=gemini-2.0-flash
```

### 3. Start the Microservice (Port 8000)
```bash
uvicorn main:app --reload --port 8000
```

The main ReflectionAi backend communicates with this service at `http://localhost:8000`.

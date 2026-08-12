# ReflectionAi — Real-Time Presentation Simulation & Synthesis

ReflectionAi is an AI-powered audience simulator and presentation intelligence platform. It ingests PowerPoint (`.pptx`) presentations, converts them into structured Word documents (`.docx`), extracts slide diagrams, indexes them for high-accuracy RAG, and simulates interactive multi-persona audience Q&A sessions.

---

## System Architecture

```
[React + Vite Frontend (Port 5173)]
             │
             ▼
[Unified Node.js Backend (Port 5000)]
             │
             ├──► [Embedded Python PPT-to-DOCX Engine] (backend/converter)
             ├──► [MySQL Database / In-Memory Store]
             └──► [Qdrant Vector DB (Port 6333)]
```

---

## Getting Started

### 1. Backend Setup (`Port 5000`)
```bash
cd backend
npm install
node server.js
```

### 2. Frontend Setup (`Port 5173`)
```bash
cd frontend
npm install
npm run dev
```

### 3. Environment Variables (`backend/.env`)
```env
PORT=5000
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=presentation_simulator
QDRANT_URL=http://127.0.0.1:6333
GROQ_API_KEYS=your_groq_keys
GEMINI_API_KEY=your_gemini_api_key
DEFAULT_MODEL=gemini-1.5-flash
```

---

## PPTX to DOCX Conversion Engine
The conversion engine is located inside `backend/converter/`. When a user uploads a `.pptx` file in the UI, `server.js` invokes `converterService.js` to parse slides, analyze diagrams, and generate a validated Word document directly without requiring an external microservice or extra port.

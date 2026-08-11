const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { processAndIndexDocument, processAndIndexStructuredDocument } = require('./ragService');
const { getOrchestrator } = require('./agentOrchestrator');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;
const PPTX_CONVERTER_URL = process.env.PPTX_CONVERTER_URL || 'http://localhost:8000';

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

app.use(cors());
app.use(express.json());

// Resilient Database layer (MySQL with automatic fallback)
let pool = null;
let useFallbackDb = false;

// Fallback in-memory data store
const memoryDb = {
  sessions: [],
  uploadedContexts: [],
  chatLogs: [],
  sessionIdCounter: 1000,
  uploadedContextIdCounter: 1000
};

try {
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'presentation_simulator',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
} catch (e) {
  console.warn('MySQL pool initialization failed, using in-memory store:', e.message);
  useFallbackDb = true;
}

const db = {
  query: async (sql, params = []) => {
    if (!useFallbackDb && pool) {
      try {
        return await pool.query(sql, params);
      } catch (err) {
        console.warn('MySQL query failed (' + err.code + '). Falling back to in-memory storage.');
        useFallbackDb = true;
      }
    }

    // In-memory fallback handler
    const lowerSql = sql.toLowerCase().trim();
    if (lowerSql.startsWith('insert into sessions')) {
      const sessionId = ++memoryDb.sessionIdCounter;
      const [title, scenarioType] = params;
      memoryDb.sessions.push({ id: sessionId, title, scenario_type: scenarioType });
      return [{ insertId: sessionId }];
    }

    if (lowerSql.startsWith('insert into uploadedcontexts')) {
      const id = ++memoryDb.uploadedContextIdCounter;
      const [sessionId, fileName, filePath, fileType] = params;
      memoryDb.uploadedContexts.push({ id, session_id: parseInt(sessionId), file_name: fileName, file_path: filePath, file_type: fileType });
      return [{ insertId: id }];
    }

    if (lowerSql.startsWith('select file_name, file_path from uploadedcontexts')) {
      const sessionId = parseInt(params[0]);
      const matched = memoryDb.uploadedContexts
        .filter(c => c.session_id === sessionId && (c.file_name.startsWith('Converted_') || c.file_type === 'application/docx'))
        .sort((a, b) => b.id - a.id);
      return [matched];
    }

    if (lowerSql.startsWith('insert into chatlogs')) {
      const [sessionId, role, msg] = params;
      memoryDb.chatLogs.push({ session_id: sessionId, speaker_role: role, message: msg, timestamp: new Date() });
      return [{ insertId: Date.now() }];
    }

    return [[]];
  }
};

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Session endpoints
app.post('/api/sessions', async (req, res) => {
  const { title, scenarioType } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO Sessions (title, scenario_type) VALUES (?, ?)',
      [title, scenarioType]
    );
    res.json({ sessionId: result.insertId, title, scenarioType });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session: ' + error.message });
  }
});


// Upload, Convert & RAG Indexing
app.post('/api/upload/:sessionId', upload.single('file'), async (req, res) => {
  const { sessionId } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(file.originalname).toLowerCase();
  const isPptx = ext === '.pptx' || ext === '.ppt' || file.mimetype.includes('presentationml') || file.mimetype.includes('powerpoint');
  const isPdf = ext === '.pdf' || file.mimetype === 'application/pdf';

  try {
    // 1. Save original upload to DB
    const safeMimeType = (file.mimetype || 'application/octet-stream').slice(0, 50);
    await db.query(
      'INSERT INTO UploadedContexts (session_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
      [sessionId, file.originalname, file.path, safeMimeType]
    );

    // 2. If PPTX, convert to DOCX via PPTX_to_DOC engine
    if (isPptx) {
      try {
        console.log(`[Session ${sessionId}] Converting PPTX to DOCX via ${PPTX_CONVERTER_URL}...`);
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), {
          filename: file.originalname
        });
        formData.append('mode', 'intelligent');

        const convResponse = await axios.post(`${PPTX_CONVERTER_URL}/api/convert`, formData, {
          headers: formData.getHeaders(),
          timeout: 120000
        });

        const convData = convResponse.data;
        const taskId = convData.task_id;
        console.log(`[Session ${sessionId}] Conversion successful. Task ID: ${taskId}`);

        // Download and save generated DOCX locally
        if (taskId) {
          const docxResponse = await axios.get(`${PPTX_CONVERTER_URL}/api/download/${taskId}`, {
            responseType: 'arraybuffer'
          });

          const docxFilename = `Converted_${sessionId}_${path.basename(file.originalname, ext)}.docx`;
          const docxPath = path.join('uploads', docxFilename);
          fs.writeFileSync(docxPath, Buffer.from(docxResponse.data));

          // Save DOCX record to DB
          await db.query(
            'INSERT INTO UploadedContexts (session_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
            [sessionId, docxFilename, docxPath, 'application/docx']
          );
        }

        // 3. Index structured presentation content into Qdrant for high-accuracy RAG
        if (convData.document_structure) {
          processAndIndexStructuredDocument(sessionId, convData.document_structure).catch(err => {
            console.error('Background structured RAG indexing failed:', err);
          });
        }

        return res.json({
          message: 'PPTX converted to DOCX and indexed successfully',
          convertedDocxUrl: `/api/download-doc/${sessionId}`,
          documentStructure: convData.document_structure,
          validationReport: convData.validation_report
        });

      } catch (convErr) {
        console.error('PPTX to DOC conversion microservice error:', convErr.message);
        // Fallback: Return success for upload but note conversion warning
        return res.json({
          message: 'File uploaded (conversion service unavailable or encountered an error)',
          error: convErr.message
        });
      }
    }

    // 4. If PDF, process and Index in Qdrant directly
    if (isPdf) {
      processAndIndexDocument(sessionId, file.path).catch(err => {
        console.error('Background PDF RAG indexing failed:', err);
      });
    }

    res.json({ message: 'File uploaded and being processed' });
  } catch (error) {
    console.error('Error saving file context:', error);
    res.status(500).json({ error: 'Failed to save file context' });
  }
});

// Download converted document for a session
app.get('/api/download-doc/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const [rows] = await db.query(
      "SELECT file_name, file_path FROM UploadedContexts WHERE session_id = ? AND (file_name LIKE 'Converted_%.docx' OR file_type = 'application/docx') ORDER BY id DESC LIMIT 1",
      [sessionId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No converted document found for this session.' });
    }

    const docx = rows[0];
    const fullPath = path.resolve(docx.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Document file not found on server disk.' });
    }

    res.download(fullPath, docx.file_name);
  } catch (err) {
    console.error('Error downloading doc:', err);
    res.status(500).json({ error: 'Failed to download document' });
  }
});


// Real-time WebSocket connection for audio/transcripts
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_session', ({ sessionId, scenarioType }) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
    // Initialize the orchestrator for this session
    getOrchestrator(sessionId, scenarioType);
  });

  socket.on('transcript_chunk', async (data) => {
    const { sessionId, text } = data;
    if (!text || text.trim() === '') return;

    console.log(`[${sessionId}] User said: ${text}`);
    
    // Process transcript through LLM Orchestrator
    const orchestrator = getOrchestrator(sessionId);
    const response = await orchestrator.processTranscript(text);

    if (response) {
      // Emit the AI's response back to the client
      io.to(sessionId).emit('ai_response', response);
      
      // Save to chat logs
      db.query(
        'INSERT INTO ChatLogs (session_id, speaker_role, message) VALUES (?, ?, ?)',
        [sessionId, response.role, response.text]
      ).catch(err => console.error("Error saving chat log:", err));
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

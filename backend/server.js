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
const { convertPptxToDocx } = require('./converterService');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;

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
        console.warn('MySQL query failed (' + (err.code || err.message) + '). Falling back to in-memory storage.');
        useFallbackDb = true;
      }
    }

    // In-memory fallback handler
    const lowerSql = sql.toLowerCase().trim();
    if (lowerSql.startsWith('insert into sessions')) {
      const sessionId = ++memoryDb.sessionIdCounter;
      const [title, customRoles] = params;
      memoryDb.sessions.push({ id: sessionId, title, custom_roles: customRoles });
      return [{ insertId: sessionId }];
    }

    if (lowerSql.startsWith('select id from sessions')) {
      const sessionId = parseInt(params[0]);
      const matched = memoryDb.sessions.filter(s => s.id === sessionId);
      return [matched];
    }

    if (lowerSql.startsWith('select custom_roles from sessions')) {
      const sessionId = parseInt(params[0]);
      const matched = memoryDb.sessions.filter(s => s.id === sessionId);
      return [matched];
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
      memoryDb.chatLogs.push({ session_id: parseInt(sessionId), speaker_role: role, message: msg, timestamp: new Date(), created_at: new Date() });
      return [{ insertId: Date.now() }];
    }

    if (lowerSql.startsWith('select speaker_role, message')) {
      const sessionId = parseInt(params[0]);
      const matched = memoryDb.chatLogs
        .filter(l => l.session_id === sessionId)
        .sort((a, b) => new Date(a.timestamp || a.created_at) - new Date(b.timestamp || b.created_at));
      return [matched];
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

// System info endpoint
const apiKeysCount = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean).length;
const prompts = require('./prompts');

app.get('/api/system/info', (req, res) => {
  res.json({ maxActors: apiKeysCount || 1 });
});

app.get('/api/system/roles', (req, res) => {
  res.json({ roles: Object.keys(prompts) });
});

// Session endpoints
app.post('/api/sessions', async (req, res) => {
  const { title, customRoles } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO Sessions (title, custom_roles) VALUES (?, ?)',
      [title, JSON.stringify(customRoles || ['General Panelist'])]
    );
    res.json({ sessionId: result.insertId, title, customRoles });
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
    // Check if session exists first
    const [sessionRows] = await db.query('SELECT id FROM Sessions WHERE id = ?', [sessionId]);
    if (!sessionRows || sessionRows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 1. Save original upload to DB
    const safeMimeType = (file.mimetype || 'application/octet-stream').slice(0, 50);
    await db.query(
      'INSERT INTO UploadedContexts (session_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
      [sessionId, file.originalname, file.path, safeMimeType]
    );

    // 2. If PPTX, convert to DOCX via embedded Python converter engine
    if (isPptx) {
      try {
        console.log(`[Session ${sessionId}] Converting PPTX to DOCX via embedded Python engine...`);
        const docxFilename = `Converted_${sessionId}_${path.basename(file.originalname, ext)}.docx`;
        const docxPath = path.join('uploads', docxFilename);

        const convData = await convertPptxToDocx(file.path, docxPath, 'intelligent');
        console.log(`[Session ${sessionId}] PPTX Conversion successful: ${docxFilename}`);

        // Save DOCX record to DB
        await db.query(
          'INSERT INTO UploadedContexts (session_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
          [sessionId, docxFilename, docxPath, 'application/docx']
        );

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
        console.error('Embedded PPTX converter error:', convErr.message);
        // Fallback: Index original document directly
        processAndIndexDocument(sessionId, file.path).catch(err => {
          console.error('Background document fallback RAG indexing failed:', err);
        });
        return res.json({
          message: 'File uploaded (conversion fallback to local parser)',
          error: convErr.message
        });
      }
    }

    // 4. If PDF or other format, process and Index in Qdrant directly
    if (isPdf || ext === '.docx') {
      processAndIndexDocument(sessionId, file.path).catch(err => {
        console.error('Background PDF/DOC RAG indexing failed:', err);
      });
    }

    res.json({ message: 'File uploaded and being processed' });
  } catch (error) {
    console.error('Error saving file context:', error);
    res.status(500).json({ error: 'Failed to save file context: ' + error.message });
  }
});

// Fetch transcript
app.get('/api/sessions/:sessionId/transcript', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const [logs] = await db.query(
      'SELECT speaker_role, message, timestamp, created_at FROM ChatLogs WHERE session_id = ? ORDER BY timestamp ASC, created_at ASC',
      [sessionId]
    );
    res.json(logs);
  } catch (error) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

// Analytics endpoint
app.get('/api/analytics/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const [logs] = await db.query(
      'SELECT speaker_role, message, timestamp, created_at FROM ChatLogs WHERE session_id = ? ORDER BY timestamp ASC, created_at ASC',
      [sessionId]
    );
    
    let userWords = 0;
    let aiInterruptions = [];
    
    if (logs.length > 0) {
      const firstTime = logs[0].timestamp || logs[0].created_at || new Date();
      const lastTime = logs[logs.length - 1].timestamp || logs[logs.length - 1].created_at || new Date();
      const startTime = new Date(firstTime).getTime();
      const endTime = new Date(lastTime).getTime();
      let durationMinutes = (endTime - startTime) / 60000;
      if (durationMinutes < 1) durationMinutes = 1;
      
      logs.forEach(log => {
        if (log.speaker_role === 'User') {
          userWords += (log.message || '').split(' ').filter(Boolean).length;
        } else {
          aiInterruptions.push({ role: log.speaker_role, message: log.message });
        }
      });
      
      res.json({
        wpm: Math.round(userWords / durationMinutes),
        interruptions: aiInterruptions
      });
    } else {
      res.json({ wpm: 0, interruptions: [] });
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
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

  socket.on('join_session', async ({ sessionId }) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
    
    // Fetch custom roles from DB
    try {
      const [rows] = await db.query('SELECT custom_roles FROM Sessions WHERE id = ?', [sessionId]);
      let customRoles = ['General Panelist'];
      if (rows && rows.length > 0 && rows[0].custom_roles) {
        try {
          customRoles = typeof rows[0].custom_roles === 'string' ? JSON.parse(rows[0].custom_roles) : rows[0].custom_roles;
        } catch (e) {
          customRoles = [rows[0].custom_roles];
        }
      }
      
      // Initialize the orchestrator for this session
      getOrchestrator(sessionId, customRoles);
      
    } catch (e) {
      console.error("Error joining session:", e);
    }
  });

  socket.on('start_presentation', async ({ sessionId }) => {
    const orchestrator = getOrchestrator(sessionId);
    if (!orchestrator.hasGreeted) {
      orchestrator.hasGreeted = true; // Prevent multiple greetings
      
      const response = await orchestrator.processTranscript("Hello! I am the presenter. I am ready to start my presentation. Please introduce yourselves briefly.");
      if (response) {
        io.to(sessionId).emit('ai_response', response);
        db.query(
          'INSERT INTO ChatLogs (session_id, speaker_role, message) VALUES (?, ?, ?)',
          [sessionId, response.role, response.text]
        ).catch(err => console.error("Error saving chat log:", err));
      }
    }
  });

  socket.on('transcript_chunk', async (data) => {
    const { sessionId, text } = data;
    if (!text || text.trim() === '') return;

    console.log(`[${sessionId}] User said: ${text}`);
    
    // Save User message to DB
    db.query(
      'INSERT INTO ChatLogs (session_id, speaker_role, message) VALUES (?, ?, ?)',
      [sessionId, 'User', text]
    ).catch(err => console.error("Error saving user chat log:", err));
    
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

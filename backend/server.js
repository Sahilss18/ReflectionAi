const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const mysql = require('mysql2/promise');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const { processAndIndexDocument } = require('./ragService');
const { getOrchestrator } = require('./agentOrchestrator');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

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
    const [result] = await pool.query(
      'INSERT INTO Sessions (title, scenario_type) VALUES (?, ?)',
      [title, scenarioType]
    );
    res.json({ sessionId: result.insertId, title, scenarioType });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Upload & RAG Indexing
app.post('/api/upload/:sessionId', upload.single('file'), async (req, res) => {
  const { sessionId } = req.params;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // 1. Save to DB
    await pool.query(
      'INSERT INTO UploadedContexts (session_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
      [sessionId, file.originalname, file.path, file.mimetype]
    );

    // 2. Process and Index in Qdrant (Background)
    if (file.mimetype === 'application/pdf') {
      processAndIndexDocument(sessionId, file.path).catch(err => {
        console.error("Background RAG indexing failed:", err);
      });
    }

    res.json({ message: 'File uploaded and being processed' });
  } catch (error) {
    console.error('Error saving file context:', error);
    res.status(500).json({ error: 'Failed to save file context' });
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
      pool.query(
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

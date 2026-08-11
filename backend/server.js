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

// System info endpoint
const apiKeysCount = (process.env.GROQ_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean).length;
const prompts = require('./prompts');

app.get('/api/system/info', (req, res) => {
  res.json({ maxActors: apiKeysCount });
});

app.get('/api/system/roles', (req, res) => {
  res.json({ roles: Object.keys(prompts) });
});

// Session endpoints
app.post('/api/sessions', async (req, res) => {
  const { title, customRoles } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO Sessions (title, custom_roles) VALUES (?, ?)',
      [title, JSON.stringify(customRoles)]
    );
    res.json({ sessionId: result.insertId, title, customRoles });
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
    // Check if session exists first to prevent foreign key errors
    const [sessionRows] = await pool.query('SELECT id FROM Sessions WHERE id = ?', [sessionId]);
    if (sessionRows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // 1. Save to DB
    await pool.query(
      'INSERT INTO UploadedContexts (session_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?)',
      [sessionId, file.originalname, file.path, file.mimetype]
    );

    // 2. Process and Index in Qdrant (Background)
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pptx')) {
      processAndIndexDocument(sessionId, file.path).catch(err => {
        console.error("Background RAG indexing failed:", err);
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
    const [logs] = await pool.query(
      'SELECT speaker_role, message, created_at FROM ChatLogs WHERE session_id = ? ORDER BY created_at ASC',
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
    const [logs] = await pool.query(
      'SELECT speaker_role, message, timestamp FROM ChatLogs WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );
    
    let userWords = 0;
    let aiInterruptions = [];
    
    if (logs.length > 0) {
      const startTime = new Date(logs[0].timestamp).getTime();
      const endTime = new Date(logs[logs.length - 1].timestamp).getTime();
      let durationMinutes = (endTime - startTime) / 60000;
      if (durationMinutes < 1) durationMinutes = 1;
      
      logs.forEach(log => {
        if (log.speaker_role === 'User') {
          userWords += log.message.split(' ').length;
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

// Real-time WebSocket connection for audio/transcripts
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_session', async ({ sessionId }) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
    
    // Fetch custom roles from DB
    try {
      const [rows] = await pool.query('SELECT custom_roles FROM Sessions WHERE id = ?', [sessionId]);
      let customRoles = ['General Panelist'];
      if (rows.length > 0 && rows[0].custom_roles) {
        customRoles = JSON.parse(rows[0].custom_roles);
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
          pool.query(
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
    pool.query(
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

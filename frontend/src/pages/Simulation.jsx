import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Mic, MicOff, PlaySquare, FileText, Download } from 'lucide-react';

const SOCKET_SERVER_URL = 'http://localhost:5000';

const Simulation = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState('User');
  const [socket, setSocket] = useState(null);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(isRecording);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    // 1. Initialize Socket
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);
    
    newSocket.emit('join_session', { sessionId });

    // Listen for AI Response
    newSocket.on('ai_response', (response) => {
      setTranscript(prev => [...prev, { speaker: response.role, text: response.text }]);
      setActiveSpeaker(response.role);
      speakText(response.text);
    });

    // 2. Initialize Web Speech API for STT
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        if (text.trim() !== '') {
          setTranscript(prev => [...prev, { speaker: 'User', text }]);
          newSocket.emit('transcript_chunk', { sessionId, text });
        }
      };

      recognition.onend = () => {
        if (isRecording) {
          recognition.start(); // Auto-restart if still "recording" mode
        }
      };

      recognitionRef.current = recognition;
    } else {
      alert("Your browser does not support the Web Speech API. Please use Chrome.");
    }

    return () => {
      newSocket.disconnect();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, [sessionId]);

  const speakText = (text) => {
    // Basic Voice Activity Detection (VAD) via Native TTS Interruption:
    window.speechSynthesis.cancel();
    
    // Auto-Mute: Stop mic while AI is talking to prevent hallucinated audio loops
    if (isRecordingRef.current) {
      try { recognitionRef.current?.stop(); } catch(e) {}
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onend = () => {
      setActiveSpeaker('User');
      
      // Auto-Unmute: Restart mic 1 second after AI finishes
      setTimeout(() => {
        if (isRecordingRef.current) {
          try { recognitionRef.current?.start(); } catch(e) {}
        }
      }, 1000);
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (isRecording) {
      try { recognitionRef.current?.stop(); } catch(e) {}
      setIsRecording(false);
      setActiveSpeaker('Idle');
    } else {
      // VAD Barge-in: if user starts speaking, stop AI
      window.speechSynthesis.cancel();
      
      // Notify backend that presentation actually started
      if (socket) {
        socket.emit('start_presentation', { sessionId });
      }
      
      try { recognitionRef.current?.start(); } catch(e) {}
      setIsRecording(true);
      setActiveSpeaker('User');
    }
  };

  const endSession = () => {
    navigate(`/analytics/${sessionId}`);
  };

  const handleDownloadDoc = () => {
    window.open(`http://localhost:5000/api/download-doc/${sessionId}`, '_blank');
  };

  const downloadTranscript = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/sessions/${sessionId}/transcript`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      let textContent = `Presentation Simulator Transcript - Session ${sessionId}\n\n`;
      data.forEach(log => {
        const timeStr = log.timestamp || log.created_at ? new Date(log.timestamp || log.created_at).toLocaleTimeString() : '';
        textContent += `[${timeStr}] ${log.speaker_role}: ${log.message}\n\n`;
      });

      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-session-${sessionId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download transcript:', error);
      alert('Failed to download transcript. Make sure the backend is running.');
    }
  };

  return (
    <div className="simulation-container">
      <div className="sim-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Live Session: {sessionId}</h2>
          <span className={`recording-indicator ${isRecording ? 'pulse' : ''}`}>
            {isRecording ? 'Recording Live' : 'Paused'}
          </span>
        </div>
        
        <button 
          onClick={handleDownloadDoc} 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: '#4338ca',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
          title="Download the converted Word document generated from your presentation"
        >
          <FileText size={16} /> Download Converted Doc (.docx)
        </button>
      </div>
      
      <div className="panel-container">
        <div className={`panelist ${activeSpeaker === 'User' ? 'active-speaker' : ''}`}>
          <div className="avatar user-avatar"><Mic size={32} /></div>
          <p>You (Presenter)</p>
        </div>
        
        {/* Dynamic avatars based on active speaker from AI responses */}
        <div className={`panelist ${activeSpeaker !== 'User' && activeSpeaker !== 'Idle' ? 'active-speaker ai-pulse' : ''}`}>
          <div className="avatar ai-avatar"><PlaySquare size={32} /></div>
          <p>{activeSpeaker !== 'User' && activeSpeaker !== 'Idle' ? activeSpeaker : 'Panel'}</p>
        </div>
      </div>

      <div className="chat-log">
        {transcript.map((msg, idx) => (
          <div key={idx} className={`msg-bubble ${msg.speaker === 'User' ? 'msg-user' : 'msg-ai'}`}>
            <strong>{msg.speaker}:</strong> {msg.text}
          </div>
        ))}
      </div>

      <div className="controls">
        <button 
          onClick={toggleRecording} 
          className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`}
        >
          {isRecording ? <><MicOff size={18}/> Stop Presenting</> : <><Mic size={18}/> Start Presenting</>}
        </button>
        
        <button onClick={endSession} className="btn btn-secondary">
          End Session & View Analytics
        </button>
        
        <button onClick={downloadTranscript} className="btn btn-secondary">
          <Download size={18} /> Download Transcript
        </button>
      </div>
    </div>
  );
};

export default Simulation;

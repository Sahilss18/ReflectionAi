import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Mic, MicOff, PlaySquare } from 'lucide-react';

const SOCKET_SERVER_URL = 'http://localhost:5000';

const Simulation = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [activeSpeaker, setActiveSpeaker] = useState('User');
  const [socket, setSocket] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Socket
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);
    
    newSocket.emit('join_session', { sessionId, scenarioType: 'office' }); // Hardcoded scenario for now unless fetched

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
    // If we're already speaking, cancel it (to handle barge-in natively)
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    utterance.onend = () => {
      setActiveSpeaker('User');
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setActiveSpeaker('Idle');
    } else {
      // VAD Barge-in: if user starts speaking, stop AI
      window.speechSynthesis.cancel();
      recognitionRef.current?.start();
      setIsRecording(true);
      setActiveSpeaker('User');
    }
  };

  const endSession = () => {
    navigate(`/analytics/${sessionId}`);
  };

  return (
    <div className="simulation-container">
      <div className="sim-header">
        <h2>Live Session: {sessionId}</h2>
        <span className={`recording-indicator ${isRecording ? 'pulse' : ''}`}>
          {isRecording ? 'Recording Live' : 'Paused'}
        </span>
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
      </div>
    </div>
  );
};

export default Simulation;

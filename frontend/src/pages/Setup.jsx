import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Setup = () => {
  const [title, setTitle] = useState('');
  const [scenarioType, setScenarioType] = useState('office');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const navigate = useNavigate();

  const handleStartSession = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setProcessingMsg('Creating session...');

    try {
      // Create session
      const sessionRes = await axios.post('http://localhost:5000/api/sessions', {
        title,
        scenarioType
      });
      const sessionId = sessionRes.data.sessionId;

      // Upload file if selected
      if (file) {
        const isPptx = file.name.endsWith('.pptx') || file.name.endsWith('.ppt');
        setProcessingMsg(
          isPptx
            ? 'Converting PPTX to structured Word document & indexing context...'
            : 'Uploading & processing document...'
        );

        const formData = new FormData();
        formData.append('file', file);
        await axios.post(`http://localhost:5000/api/upload/${sessionId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Navigate to simulation
      navigate(`/simulation/${sessionId}`);
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session: ' + (error.response?.data?.error || error.message));
      setIsProcessing(false);
    }
  };

  return (
    <div className="setup-container">
      <h2>Session Setup</h2>
      <form onSubmit={handleStartSession}>
        <div className="form-group">
          <label>Presentation Title</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            disabled={isProcessing}
          />
        </div>
        
        <div className="form-group">
          <label>Scenario / Target Audience</label>
          <select 
            value={scenarioType} 
            onChange={(e) => setScenarioType(e.target.value)}
            disabled={isProcessing}
          >
            <option value="academic">Students & Researchers</option>
            <option value="sales">Sales Representatives</option>
            <option value="investor">Business & Founders (Investor Pitch)</option>
            <option value="office">Office Presentation / Internal</option>
            <option value="interview">Job Seekers</option>
          </select>
        </div>

        <div className="form-group">
          <label>Upload Presentation (PPTX / PDF)</label>
          <input 
            type="file" 
            accept=".pptx,.ppt,.pdf"
            onChange={(e) => setFile(e.target.files[0])} 
            disabled={isProcessing}
          />
          {file && file.name.endsWith('.pptx') && (
            <small style={{ color: '#6366f1', marginTop: '4px', display: 'block' }}>
              ✨ AI will transform this PPTX into a structured .docx document & index diagrams for the simulation.
            </small>
          )}
        </div>

        {isProcessing ? (
          <div style={{ textAlign: 'center', padding: '12px', color: '#4f46e5', fontWeight: '500' }}>
            <span className="spinner">⏳ </span> {processingMsg}
          </div>
        ) : (
          <button type="submit" className="btn-primary">Start Simulation</button>
        )}
      </form>
    </div>
  );
};

export default Setup;

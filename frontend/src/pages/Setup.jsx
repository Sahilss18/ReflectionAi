import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Setup = () => {
  const [title, setTitle] = useState('');
  const [scenarioType, setScenarioType] = useState('office');
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const handleStartSession = async (e) => {
    e.preventDefault();
    try {
      // Create session
      const sessionRes = await axios.post('http://localhost:5000/api/sessions', {
        title,
        scenarioType
      });
      const sessionId = sessionRes.data.sessionId;

      // Upload file if selected
      if (file) {
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
      alert('Failed to start session.');
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
          />
        </div>
        
        <div className="form-group">
          <label>Scenario / Target Audience</label>
          <select value={scenarioType} onChange={(e) => setScenarioType(e.target.value)}>
            <option value="academic">Students & Researchers</option>
            <option value="sales">Sales Representatives</option>
            <option value="investor">Business & Founders (Investor Pitch)</option>
            <option value="office">Office Presentation / Internal</option>
            <option value="interview">Job Seekers</option>
          </select>
        </div>

        <div className="form-group">
          <label>Upload Context (PDF/PPTX)</label>
          <input 
            type="file" 
            onChange={(e) => setFile(e.target.files[0])} 
          />
        </div>

        <button type="submit" className="btn-primary">Start Simulation</button>
      </form>
    </div>
  );
};

export default Setup;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Setup = () => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [maxActors, setMaxActors] = useState(1);
  const [numActors, setNumActors] = useState(1);
  const [customRoles, setCustomRoles] = useState(['StrictExternalExaminer']);
  const [availableRoles, setAvailableRoles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch max available actors based on API keys
    axios.get('http://localhost:5000/api/system/info')
      .then(res => {
        const max = res.data.maxActors || 1;
        setMaxActors(max);
        if (numActors > max) {
          setNumActors(max);
        }
      })
      .catch(err => console.error("Error fetching system info:", err));

    // Fetch available predefined roles
    axios.get('http://localhost:5000/api/system/roles')
      .then(res => {
        setAvailableRoles(res.data.roles || []);
        if (res.data.roles && res.data.roles.length > 0) {
          setCustomRoles([res.data.roles[0]]);
        }
      })
      .catch(err => console.error("Error fetching roles:", err));
  }, []);

  const handleNumActorsChange = (e) => {
    let count = parseInt(e.target.value) || 1;
    if (count > maxActors) count = maxActors;
    if (count < 1) count = 1;
    setNumActors(count);
    
    // Adjust custom roles array size
    const newRoles = [...customRoles];
    while (newRoles.length < count) {
      newRoles.push(availableRoles.length > 0 ? availableRoles[0] : 'StrictExternalExaminer');
    }
    setCustomRoles(newRoles.slice(0, count));
  };

  const handleRoleChange = (index, value) => {
    const newRoles = [...customRoles];
    newRoles[index] = value;
    setCustomRoles(newRoles);
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setProcessingMsg('Creating session...');

    try {
      // Create session with chosen title and custom actor roles
      const sessionRes = await axios.post('http://localhost:5000/api/sessions', {
        title,
        customRoles
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
          <label>Number of Actors (Max: {maxActors})</label>
          <input 
            type="number" 
            min="1" 
            max={maxActors}
            value={numActors} 
            onChange={handleNumActorsChange} 
            disabled={isProcessing}
          />
        </div>

        {customRoles.map((role, idx) => (
          <div className="form-group" key={idx}>
            <label>Actor {idx + 1} Role</label>
            <select 
              value={role} 
              onChange={(e) => handleRoleChange(idx, e.target.value)}
              disabled={isProcessing}
              required
            >
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        ))}

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

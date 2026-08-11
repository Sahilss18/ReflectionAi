import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Setup = () => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [maxActors, setMaxActors] = useState(1);
  const [numActors, setNumActors] = useState(1);
  const [customRoles, setCustomRoles] = useState(['StrictExternalExaminer']);
  const [availableRoles, setAvailableRoles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch max available actors based on API keys
    axios.get('http://localhost:5000/api/system/info')
      .then(res => {
        setMaxActors(res.data.maxActors || 1);
        if (numActors > res.data.maxActors) {
            setNumActors(res.data.maxActors);
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
    try {
      // Create session
      const sessionRes = await axios.post('http://localhost:5000/api/sessions', {
        title,
        customRoles
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
          <label>Number of Actors (Max: {maxActors})</label>
          <input 
            type="number" 
            min="1" 
            max={maxActors}
            value={numActors} 
            onChange={handleNumActorsChange} 
          />
        </div>

        {customRoles.map((role, idx) => (
          <div className="form-group" key={idx}>
            <label>Actor {idx + 1} Role</label>
            <select 
              value={role} 
              onChange={(e) => handleRoleChange(idx, e.target.value)}
              required
            >
              {availableRoles.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        ))}

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

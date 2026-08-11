import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const Analytics = () => {
  const { sessionId } = useParams();
  const [data, setData] = useState({ wpm: 0, interruptions: [] });

  useEffect(() => {
    axios.get(`http://localhost:5000/api/analytics/${sessionId}`)
      .then(res => setData(res.data))
      .catch(err => console.error("Error fetching analytics:", err));
  }, [sessionId]);

  return (
    <div className="analytics-container">
      <h2>Session Analytics</h2>
      <p>Session ID: {sessionId}</p>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Pacing (WPM)</h3>
          <p className="score">{data.wpm} WPM</p>
        </div>
        <div className="metric-card">
          <h3>Total Interruptions</h3>
          <p className="score">{data.interruptions.length}</p>
        </div>
      </div>

      <div className="objections-log">
        <h3>Panelist Objections & Interventions</h3>
        {data.interruptions.length === 0 ? (
          <p>No interruptions recorded.</p>
        ) : (
          <ul>
            {data.interruptions.map((int, idx) => (
              <li key={idx}><strong>{int.role}:</strong> {int.message}</li>
            ))}
          </ul>
        )}
      </div>

      <Link to="/" className="btn btn-primary">Start New Session</Link>
    </div>
  );
};

export default Analytics;

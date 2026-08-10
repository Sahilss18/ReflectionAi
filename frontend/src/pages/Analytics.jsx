import React from 'react';
import { useParams, Link } from 'react-router-dom';

const Analytics = () => {
  const { sessionId } = useParams();

  return (
    <div className="analytics-container">
      <h2>Session Analytics</h2>
      <p>Session ID: {sessionId}</p>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Context Accuracy Score</h3>
          <p className="score">85%</p>
        </div>
        <div className="metric-card">
          <h3>Pacing (WPM)</h3>
          <p className="score">142 WPM</p>
        </div>
        <div className="metric-card">
          <h3>Filler Words</h3>
          <p className="score">12</p>
        </div>
      </div>

      <div className="objections-log">
        <h3>Panelist Objections & Interventions</h3>
        <ul>
          <li><strong>Tech Lead:</strong> Asked about deployment strategy (Slide 4). Handled well.</li>
          <li><strong>VP:</strong> Interrupted to ask about ROI. You hesitated for 4 seconds before answering.</li>
        </ul>
      </div>

      <Link to="/" className="btn btn-primary">Start New Session</Link>
    </div>
  );
};

export default Analytics;

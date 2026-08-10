import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Setup from './pages/Setup';
import Simulation from './pages/Simulation';
import Analytics from './pages/Analytics';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1>Presentation Simulator</h1>
        </header>
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Setup />} />
            <Route path="/simulation/:sessionId" element={<Simulation />} />
            <Route path="/analytics/:sessionId" element={<Analytics />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

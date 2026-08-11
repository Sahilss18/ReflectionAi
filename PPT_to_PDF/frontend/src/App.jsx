import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import Navbar from './components/Navbar';
import UploadZone from './components/UploadZone';
import ProcessingTimeline from './components/ProcessingTimeline';
import ResultsHub from './components/ResultsHub';
import SettingsModal from './components/SettingsModal';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [conversionResult, setConversionResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleConvert = async (file, mode) => {
    setIsConverting(true);
    setErrorMsg(null);
    setConversionResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (apiKey) {
      formData.append('api_key', apiKey);
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/convert`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Conversion failed.');
      }

      const data = await response.json();
      setConversionResult(data);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'An unexpected error occurred during conversion.');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSampleGenerate = async () => {
    setIsLoadingSample(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-sample`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate sample presentation');
      
      const blob = await res.blob();
      const sampleFile = new File([blob], 'sample_clinical_presentation.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      
      // Auto convert sample presentation
      await handleConvert(sampleFile, 'intelligent');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div className="app-container">
      <Navbar 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        isConfigured={Boolean(apiKey)} 
      />

      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '14px 20px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '24px',
          fontSize: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span><strong>Error:</strong> {errorMsg}</span>
          <button 
            onClick={() => setErrorMsg(null)}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {!conversionResult && !isConverting && (
        <UploadZone 
          onConvert={handleConvert}
          isConverting={isConverting}
          onSampleGenerate={handleSampleGenerate}
          isLoadingSample={isLoadingSample}
        />
      )}

      {isConverting && (
        <ProcessingTimeline />
      )}

      {conversionResult && !isConverting && (
        <ResultsHub 
          result={conversionResult} 
          onReset={() => setConversionResult(null)} 
        />
      )}

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
}

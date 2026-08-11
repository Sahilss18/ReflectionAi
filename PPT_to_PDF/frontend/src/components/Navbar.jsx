import React from 'react';
import { FileText, Sparkles, Settings, Layers } from 'lucide-react';

export default function Navbar({ onOpenSettings, isConfigured }) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      marginBottom: '32px',
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(9, 13, 22, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      borderRadius: 'var(--radius-md)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
        }}>
          <FileText size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '19px', fontWeight: '800', letterSpacing: '-0.02em' }}>
              PPTX <span className="gradient-text">to DOCX</span>
            </h1>
            <span className="badge badge-blue" style={{ fontSize: '11px', padding: '2px 8px' }}>
              <Sparkles size={11} /> Multimodal AI
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Semantic Document Architect & Diagram Understanding
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onOpenSettings}
          className="btn-secondary"
          title="Configure API Settings"
        >
          <Settings size={16} />
          <span>API Config</span>
          {isConfigured && (
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 8px #10b981'
            }} />
          )}
        </button>
      </div>
    </header>
  );
}

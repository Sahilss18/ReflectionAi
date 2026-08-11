import React, { useState, useRef } from 'react';
import { UploadCloud, FileType, CheckCircle, Sparkles, BookOpen, FileCheck, Layers, Play } from 'lucide-react';

export default function UploadZone({ onConvert, isConverting, onSampleGenerate, isLoadingSample }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [conversionMode, setConversionMode] = useState('intelligent');
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.pptx') || file.name.endsWith('.PPTX')) {
        setSelectedFile(file);
      } else {
        alert("Please select a valid PowerPoint (.pptx) file.");
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onConvert(selectedFile, conversionMode);
  };

  const modes = [
    {
      id: 'intelligent',
      title: 'Intelligent Synthesis',
      badge: 'Recommended',
      badgeClass: 'badge-verified',
      icon: <Sparkles size={18} color="#34d399" />,
      desc: 'Transforms fragmented slide bullets into fluent paragraphs, explains diagram flows, integrates notes with zero hallucination.'
    },
    {
      id: 'faithful',
      title: 'Faithful 1:1 Match',
      badge: 'Direct',
      badgeClass: 'badge-blue',
      icon: <FileCheck size={18} color="#60a5fa" />,
      desc: 'Preserves exact slide-by-slide structure, verbatim bullet hierarchy, and tables in Word format.'
    },
    {
      id: 'executive_summary',
      title: 'Executive Report',
      badge: 'Briefing',
      badgeClass: 'badge-flagged',
      icon: <BookOpen size={18} color="#fbbf24" />,
      desc: 'Generates a condensed strategic overview, key metric tables, and critical architecture takeaways.'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Upload Box */}
      <div 
        className={`glass-panel ${dragActive ? 'pulsing-glow' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current.click()}
        style={{
          padding: '44px 30px',
          textAlign: 'center',
          cursor: selectedFile ? 'default' : 'pointer',
          border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          background: dragActive ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
          transition: 'all 0.25s ease'
        }}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div style={{
          width: '68px',
          height: '68px',
          borderRadius: '20px',
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: '0 0 30px rgba(59, 130, 246, 0.2)'
        }}>
          {selectedFile ? (
            <CheckCircle size={36} color="#10b981" />
          ) : (
            <UploadCloud size={36} color="#60a5fa" />
          )}
        </div>

        {selectedFile ? (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>
              {selectedFile.name}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for Multimodal Extraction
            </p>
            <button 
              className="btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              Choose Different Presentation
            </button>
          </div>
        ) : (
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
              Upload PowerPoint Presentation
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto 20px' }}>
              Drag and drop your <span style={{ color: '#60a5fa', fontWeight: '600' }}>.pptx</span> presentation here, or click to browse files.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button 
                type="button"
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current.click();
                }}
              >
                <FileType size={16} /> Browse Files
              </button>

              <button 
                type="button"
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onSampleGenerate();
                }}
                disabled={isLoadingSample}
                style={{ borderColor: 'rgba(99, 102, 241, 0.4)', background: 'rgba(99, 102, 241, 0.1)' }}
              >
                <Sparkles size={16} color="#a78bfa" />
                <span>{isLoadingSample ? 'Generating...' : 'Use Sample AI Presentation'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mode Selector */}
      <div>
        <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} /> Select Conversion Mode
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {modes.map((m) => {
            const isSelected = conversionMode === m.id;
            return (
              <div 
                key={m.id}
                onClick={() => setConversionMode(m.id)}
                className={`glass-panel glass-panel-hover`}
                style={{
                  padding: '18px 20px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-card)',
                  boxShadow: isSelected ? '0 0 25px rgba(59, 130, 246, 0.25)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {m.icon}
                    <h5 style={{ fontSize: '15px', fontWeight: '700' }}>{m.title}</h5>
                  </div>
                  <span className={`badge ${m.badgeClass}`}>{m.badge}</span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  {m.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button 
          onClick={handleSubmit}
          disabled={!selectedFile || isConverting}
          className="btn-primary"
          style={{ padding: '14px 36px', fontSize: '16px' }}
        >
          {isConverting ? (
            <>
              <div className="animate-spin" style={{ width: '18px', height: '18px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
              <span>Processing Pipeline...</span>
            </>
          ) : (
            <>
              <Play size={18} />
              <span>Convert Presentation to Word (.docx)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

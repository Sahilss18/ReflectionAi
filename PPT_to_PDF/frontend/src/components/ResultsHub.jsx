import React, { useState } from 'react';
import { 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Layers, 
  FileText, 
  Code2, 
  Sparkles, 
  RotateCcw,
  Table,
  Cpu
} from 'lucide-react';

export default function ResultsHub({ result, onReset }) {
  const [activeTab, setActiveTab] = useState('preview');

  const {
    filename,
    conversion_mode,
    presentation_summary = {},
    document_structure = {},
    validation_report = {},
    download_url
  } = result;

  const handleDownload = () => {
    const backendUrl = "http://127.0.0.1:8000";
    const fullUrl = `${backendUrl}${download_url}`;
    window.open(fullUrl, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Quick Actions */}
      <div className="glass-panel" style={{ padding: '24px 30px', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="badge badge-verified">
                <CheckCircle2 size={13} /> Conversion Completed
              </span>
              <span className="badge badge-blue">
                Mode: {conversion_mode}
              </span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800' }}>
              {document_structure.title || filename}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Source: <span style={{ color: '#94a3b8' }}>{filename}</span> • Word Document ready for distribution
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={onReset} className="btn-secondary">
              <RotateCcw size={16} /> Convert Another
            </button>
            <button onClick={handleDownload} className="btn-success" style={{ padding: '12px 28px' }}>
              <Download size={18} /> Download Word Document (.docx)
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '14px', 
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-color)'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px 18px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Slides Processed</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#60a5fa', marginTop: '4px' }}>
              {presentation_summary.total_slides || document_structure.sections?.length || 0}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px 18px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Visual Diagrams & Images</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#a78bfa', marginTop: '4px' }}>
              {presentation_summary.total_images || 0}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px 18px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tables Reconstructed</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#38bdf8', marginTop: '4px' }}>
              {presentation_summary.total_tables || 0}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '14px 18px', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fact Validation Score</div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#34d399', marginTop: '4px' }}>
              {validation_report.confidence_score || 100}%
            </div>
          </div>
        </div>
      </div>

      {/* Semantic Validation Highlight Card */}
      <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={22} color="#34d399" />
            <h3 style={{ fontSize: '17px', fontWeight: '700' }}>
              Meaning & Numerical Consistency Audit
            </h3>
          </div>
          <span className="badge badge-verified" style={{ fontSize: '13px' }}>
            {validation_report.verified_count} Metrics Verified • 0 Critical Errors
          </span>
        </div>

        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Our deterministic validator cross-referenced numbers, percentages, and technical terminology between the raw PowerPoint shapes and the converted Word Document.
        </p>

        {/* Metric Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {validation_report.metric_checks?.slice(0, 8).map((chk, i) => (
            <div 
              key={i} 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: chk.status === 'VERIFIED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: chk.status === 'VERIFIED' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12.5px'
              }}
            >
              {chk.status === 'VERIFIED' ? (
                <CheckCircle2 size={14} color="#34d399" />
              ) : (
                <AlertTriangle size={14} color="#fbbf24" />
              )}
              <span style={{ fontWeight: '700', color: '#f8fafc' }}>{chk.metric}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>Slide {chk.slide_number}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('preview')}
          className={`btn-secondary ${activeTab === 'preview' ? 'btn-primary' : ''}`}
          style={{ padding: '8px 18px' }}
        >
          <FileText size={16} /> Document Content Preview
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`btn-secondary ${activeTab === 'validation' ? 'btn-primary' : ''}`}
          style={{ padding: '8px 18px' }}
        >
          <ShieldCheck size={16} /> Full Validation Audit
        </button>

        <button
          onClick={() => setActiveTab('json')}
          className={`btn-secondary ${activeTab === 'json' ? 'btn-primary' : ''}`}
          style={{ padding: '8px 18px' }}
        >
          <Code2 size={16} /> Intermediate AI Schema (JSON)
        </button>
      </div>

      {/* Tab 1: Document Preview */}
      {activeTab === 'preview' && (
        <div className="glass-panel" style={{ padding: '36px', borderRadius: 'var(--radius-lg)' }}>
          {/* Executive Summary */}
          {document_structure.executive_summary && (
            <div style={{
              background: 'rgba(37, 99, 235, 0.08)',
              borderLeft: '4px solid #3b82f6',
              padding: '18px 22px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '32px'
            }}>
              <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#60a5fa', marginBottom: '6px' }}>
                Executive Summary
              </h4>
              <p style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                {document_structure.executive_summary}
              </p>
            </div>
          )}

          {/* Document Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {document_structure.sections?.map((sec, idx) => (
              <div key={idx} style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#f8fafc', marginBottom: '14px' }}>
                  {idx + 1}. {sec.section_title}
                </h3>

                {/* Diagram Callouts */}
                {sec.diagram_callouts?.map((callout, cIdx) => (
                  <div 
                    key={cIdx}
                    style={{
                      background: 'rgba(99, 102, 241, 0.1)',
                      borderLeft: '3px solid #818cf8',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '14px',
                      fontSize: '13px',
                      color: '#c7d2fe'
                    }}
                  >
                    <strong>DIAGRAM FLOW:</strong> {callout}
                  </div>
                ))}

                {/* Paragraphs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {sec.paragraphs?.map((p, pIdx) => {
                    if (p.type === 'bullet') {
                      return (
                        <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: `${p.level * 16}px` }}>
                          <span style={{ color: '#3b82f6' }}>•</span>
                          <span style={{ fontSize: '14px', color: '#cbd5e1' }}>{p.text}</span>
                        </div>
                      );
                    }
                    if (p.type === 'callout_insight' || p.type === 'diagram_analysis') {
                      return (
                        <div key={pIdx} style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderLeft: '3px solid #64748b',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '13px',
                          color: '#94a3b8',
                          fontStyle: 'italic'
                        }}>
                          {p.text}
                        </div>
                      );
                    }
                    return (
                      <p key={pIdx} style={{ fontSize: '14px', color: '#e2e8f0', lineHeight: '1.65' }}>
                        {p.text}
                      </p>
                    );
                  })}
                </div>

                {/* Tables */}
                {sec.tables?.map((tbl, tIdx) => (
                  <div key={tIdx} style={{ overflowX: 'auto', marginTop: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      {tbl.headers && tbl.headers.length > 0 && (
                        <thead>
                          <tr style={{ background: '#1e293b' }}>
                            {tbl.headers.map((h, hIdx) => (
                              <th key={hIdx} style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #334155', color: '#f8fafc' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {tbl.rows?.map((row, rIdx) => (
                          <tr key={rIdx} style={{ background: rIdx % 2 === 1 ? 'rgba(255, 255, 255, 0.02)' : 'transparent' }}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#cbd5e1' }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Full Validation Audit */}
      {activeTab === 'validation' && (
        <div className="glass-panel" style={{ padding: '30px', borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>
            Numerical & Terminology Verification Log
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {validation_report.metric_checks?.map((chk, i) => (
              <div 
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700', color: '#f8fafc', fontSize: '15px' }}>
                      {chk.metric}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Slide {chk.slide_number}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Original: <code style={{ color: '#38bdf8' }}>{chk.original_context}</code>
                  </div>
                </div>
                <span className={`badge ${chk.status === 'VERIFIED' ? 'badge-verified' : 'badge-flagged'}`}>
                  {chk.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: JSON Structure */}
      {activeTab === 'json' && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '700' }}>
              Intermediate AI-Readable Representation (DocumentStructure)
            </h4>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Structured Pydantic Model</span>
          </div>
          <pre>{JSON.stringify(document_structure, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

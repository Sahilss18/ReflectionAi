import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Sparkles, FileSearch, Cpu, ShieldCheck, FileOutput } from 'lucide-react';

export default function ProcessingTimeline({ currentStep = 0 }) {
  const steps = [
    {
      id: 1,
      title: "Slide Structure Extraction",
      desc: "Extracting native text, headings, bullets, tables, and notes via python-pptx",
      icon: <FileSearch size={18} color="#60a5fa" />
    },
    {
      id: 2,
      title: "Multimodal Vision & OCR",
      desc: "Analyzing architecture diagrams, flowchart relationships, and image metrics",
      icon: <Cpu size={18} color="#a78bfa" />
    },
    {
      id: 3,
      title: "Semantic Restructuring",
      desc: "Converting bullets to structured narrative prose with zero hallucination",
      icon: <Sparkles size={18} color="#38bdf8" />
    },
    {
      id: 4,
      title: "Semantic Fact Validation",
      desc: "Cross-checking numbers (e.g. 99.47%), named entities, and completeness",
      icon: <ShieldCheck size={18} color="#34d399" />
    },
    {
      id: 5,
      title: "DOCX Document Generation",
      desc: "Applying corporate typography, diagram callouts, zebra tables, and formatting",
      icon: <FileOutput size={18} color="#f59e0b" />
    }
  ];

  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    // Simulated step progression for smooth visual feedback
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel" style={{ padding: '32px', borderRadius: 'var(--radius-lg)', marginTop: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '6px' }}>
          Processing Presentation
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Executing the multimodal AI transformation pipeline...
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px', margin: '0 auto' }}>
        {steps.map((step) => {
          const isDone = activeStep > step.id;
          const isCurrent = activeStep === step.id;

          return (
            <div 
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '14px 18px',
                borderRadius: 'var(--radius-sm)',
                background: isCurrent ? 'rgba(59, 130, 246, 0.1)' : (isDone ? 'rgba(16, 185, 129, 0.05)' : 'transparent'),
                border: isCurrent ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                transition: 'all 0.3s ease'
              }}
            >
              <div style={{ marginTop: '2px' }}>
                {isDone ? (
                  <CheckCircle2 size={22} color="#10b981" />
                ) : isCurrent ? (
                  <Loader2 size={22} color="#3b82f6" className="animate-spin" />
                ) : (
                  <Circle size={22} color="#475569" />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {step.icon}
                  <h4 style={{ 
                    fontSize: '15px', 
                    fontWeight: isCurrent ? '700' : '600',
                    color: isCurrent ? '#f8fafc' : (isDone ? '#e2e8f0' : '#64748b')
                  }}>
                    {step.title}
                  </h4>
                </div>
                <p style={{ fontSize: '12.5px', color: isCurrent ? '#94a3b8' : '#64748b', marginTop: '3px' }}>
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

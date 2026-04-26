"use client";

import { useState, useRef, useEffect } from "react";
import { PipelineResult, RankedCandidate, ParsedJD, Candidate } from "@/types";
import Dashboard from "./dashboard/page";
import CandidateManager from "@/components/CandidateManager";

const STORAGE_KEY = "catalyst_pipeline_result";

const SAMPLE_JD = `Senior Full Stack Engineer — FinTech Startup

We're a Series B fintech startup building the next generation of embedded finance infrastructure. We process $2B+ in transactions annually and are growing 3x YoY.

About the Role:
We're looking for a Senior Full Stack Engineer to join our core platform team. You'll build the systems that power real-time payment processing, fraud detection, and merchant analytics.

Requirements:
- 5+ years of full-stack experience
- Strong proficiency in React and TypeScript (frontend)
- Node.js or similar backend experience
- PostgreSQL and Redis experience
- Experience with AWS or GCP
- Prior experience in fintech, payments, or high-transaction systems is a strong plus

Nice to Have:
- GraphQL experience
- Docker/Kubernetes knowledge
- Experience with event-driven architectures (Kafka/SQS)

What You'll Do:
- Build and maintain payment processing APIs handling millions of daily transactions
- Develop merchant-facing dashboards with real-time analytics
- Collaborate with design and product on new features
- Participate in on-call rotation for production systems

Compensation: $175,000 – $220,000 base + equity
Location: San Francisco, CA (Hybrid — 2 days/week in office)
`;

interface ProgressStep {
  step: string;
  message: string;
  progress?: number;
}

export default function Home() {
  const [jdText, setJdText] = useState(SAMPLE_JD);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore last result from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setResult(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Persist result to localStorage whenever it changes
  useEffect(() => {
    if (!result) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); } catch { /* quota */ }
  }, [result]);

  const runPipeline = async () => {
    if (!jdText.trim()) return;
    setIsRunning(true);
    setProgressSteps([]);
    setResult(null);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/full-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, candidates: candidates.length > 0 ? candidates : undefined }),
        signal: abortRef.current.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);

            if (data.step === "error") {
              setError(data.message);
              setIsRunning(false);
              return;
            }

            if (data.step === "complete") {
              setResult(data.result);
              setIsRunning(false);
              return;
            }

            setProgressSteps((prev) => {
              const existing = prev.findIndex((s) => s.step === data.step);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = data;
                return updated;
              }
              return [...prev, data];
            });
          } catch {
            // partial JSON, ignore
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setError(String(err));
      }
      setIsRunning(false);
    }
  };

  if (result) {
    return <Dashboard result={result} onReset={() => { setResult(null); localStorage.removeItem(STORAGE_KEY); }} />;
  }

  const getStepIcon = (step: string, isLatest: boolean) => {
    if (isLatest && isRunning) return "⟳";
    switch (step) {
      case "parsing": return "📄";
      case "parsed": return "✓";
      case "matching": return "🔍";
      case "matched": return "✓";
      case "conversing": return "💬";
      default: return "✓";
    }
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <div className="logo-lockup">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">Catalyst</span>
            <span className="logo-tag">AI Talent Agent</span>
          </div>
          <nav className="header-nav">
            <a href="https://github.com/Subham2512/Catalyst-deccan-ai" target="_blank" className="nav-link">
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-section">
          <div className="hero-badge">Hackathon Build · Catalyst 2025</div>
          <h1 className="hero-title">
            From Job Description<br />
            to <em>Ranked Shortlist</em>
          </h1>
          <p className="hero-subtitle">
            Paste a JD. Our AI agent discovers matching candidates, simulates outreach conversations,
            and ranks them by both skill fit and genuine interest — in under 2 minutes.
          </p>

          {/* <div className="stats-row">
            <div className="stat-chip">
              <span className="stat-num">15</span>
              <span className="stat-label">Candidates Scanned</span>
            </div>
            <div className="stat-divider">→</div>
            <div className="stat-chip">
              <span className="stat-num">6</span>
              <span className="stat-label">Conversations Simulated</span>
            </div>
            <div className="stat-divider">→</div>
            <div className="stat-chip">
              <span className="stat-num">2</span>
              <span className="stat-label">Scores Per Candidate</span>
            </div>
          </div> */}
        </section>

        <section className="input-section">
          <div className="input-card">
            <div className="input-card-header">
              <h2 className="input-card-title">Job Description</h2>
              <button
                className="sample-btn"
                onClick={() => setJdText(SAMPLE_JD)}
              >
                Load Sample JD
              </button>
            </div>
            <textarea
              className="jd-textarea"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste your full job description here..."
              rows={16}
            />
            <div className="input-card-footer">
              <span className="char-count">{jdText.length} characters</span>
              <button
                className="run-btn"
                onClick={runPipeline}
                disabled={isRunning || jdText.trim().length < 50}
              >
                {isRunning ? (
                  <>
                    <span className="spin-icon">⟳</span>
                    Running Pipeline...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Run AI Pipeline
                  </>
                )}
              </button>
            </div>
          </div>

          <CandidateManager candidates={candidates} onChange={setCandidates} />

          {(isRunning || progressSteps.length > 0) && (
            <div className="progress-panel">
              <h3 className="progress-title">Pipeline Progress</h3>
              <div className="progress-steps">
                {progressSteps.map((step, i) => (
                  <div
                    key={step.step + i}
                    className={`progress-step ${i === progressSteps.length - 1 && isRunning ? "active" : "done"}`}
                  >
                    <span className="step-icon">
                      {getStepIcon(step.step, i === progressSteps.length - 1)}
                    </span>
                    <span className="step-message">{step.message}</span>
                    {step.progress !== undefined && (
                      <div className="step-progress-bar">
                        <div
                          className="step-progress-fill"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="error-panel">
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>

        <section className="how-section">
          <h2 className="how-title">How It Works</h2>
          <div className="how-steps">
            {[
              { icon: "📄", label: "JD Parsing", desc: "Gemini extracts skills, experience, seniority, and requirements" },
              { icon: "🔍", label: "Candidate Discovery", desc: "Semantic matching against 15 candidate profiles with explainability" },
              { icon: "💬", label: "Simulated Outreach", desc: "AI roleplays realistic recruiter ↔ candidate conversations" },
              { icon: "📊", label: "Dual Scoring", desc: "55% Match Score + 45% Interest Score = Combined Rank" },
            ].map((step) => (
              <div key={step.label} className="how-step">
                <div className="how-step-icon">{step.icon}</div>
                <div className="how-step-label">{step.label}</div>
                <div className="how-step-desc">{step.desc}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <style jsx>{`
        .app-shell {
          min-height: 100vh;
          background: var(--bg);
          font-family: var(--font-body);
        }

        .site-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(8, 8, 12, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          padding: 0 24px;
        }

        .header-inner {
          max-width: 1100px;
          margin: 0 auto;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo-lockup {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-icon {
          font-size: 20px;
        }

        .logo-text {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
          color: var(--fg);
          letter-spacing: -0.03em;
        }

        .logo-tag {
          font-size: 11px;
          font-weight: 500;
          color: var(--accent);
          background: rgba(99, 255, 180, 0.1);
          border: 1px solid rgba(99, 255, 180, 0.2);
          padding: 2px 8px;
          border-radius: 99px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .nav-link {
          color: var(--muted);
          font-size: 14px;
          text-decoration: none;
          transition: color 0.2s;
        }
        .nav-link:hover { color: var(--fg); }

        .main-content {
          max-width: 900px;
          margin: 0 auto;
          padding: 80px 24px 120px;
        }

        .hero-section {
          text-align: center;
          margin-bottom: 64px;
        }

        .hero-badge {
          display: inline-block;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
          background: rgba(99, 255, 180, 0.08);
          border: 1px solid rgba(99, 255, 180, 0.2);
          padding: 5px 14px;
          border-radius: 99px;
          margin-bottom: 28px;
        }

        .hero-title {
          font-family: var(--font-display);
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: var(--fg);
          margin: 0 0 20px;
        }

        .hero-title em {
          font-style: normal;
          color: var(--accent);
        }

        .hero-subtitle {
          font-size: 18px;
          line-height: 1.6;
          color: var(--muted);
          max-width: 580px;
          margin: 0 auto 40px;
        }

        .stats-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .stat-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
        }

        .stat-num {
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 800;
          color: var(--fg);
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .stat-label {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-top: 4px;
        }

        .stat-divider {
          font-size: 20px;
          color: var(--border);
        }

        .input-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 80px;
        }

        .input-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
        }

        .input-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1px solid var(--border);
        }

        .input-card-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--fg);
          margin: 0;
          letter-spacing: -0.02em;
        }

        .sample-btn {
          font-size: 12px;
          font-weight: 500;
          color: var(--accent);
          background: rgba(99, 255, 180, 0.08);
          border: 1px solid rgba(99, 255, 180, 0.2);
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-body);
        }
        .sample-btn:hover {
          background: rgba(99, 255, 180, 0.15);
        }

        .jd-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: var(--fg);
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.7;
          padding: 20px 24px;
          box-sizing: border-box;
        }

        .jd-textarea::placeholder {
          color: var(--muted);
        }

        .input-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-top: 1px solid var(--border);
        }

        .char-count {
          font-size: 12px;
          color: var(--muted);
        }

        .run-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--accent);
          color: #000;
          border: none;
          padding: 12px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          font-family: var(--font-body);
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 0.01em;
        }

        .run-btn:hover:not(:disabled) {
          background: #7fffc4;
          transform: translateY(-1px);
        }

        .run-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spin-icon {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .progress-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 24px;
        }

        .progress-title {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
          color: var(--fg);
          margin: 0 0 16px;
          letter-spacing: -0.02em;
        }

        .progress-steps {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .progress-step {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14px;
          color: var(--muted);
        }

        .progress-step.active {
          color: var(--fg);
        }

        .progress-step.done {
          color: var(--accent);
        }

        .step-icon {
          font-size: 14px;
          width: 20px;
          text-align: center;
        }

        .step-progress-bar {
          flex: 1;
          height: 3px;
          background: var(--border);
          border-radius: 99px;
          overflow: hidden;
          max-width: 200px;
        }

        .step-progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 99px;
          transition: width 0.3s;
        }

        .error-panel {
          background: rgba(255, 80, 80, 0.1);
          border: 1px solid rgba(255, 80, 80, 0.3);
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 14px;
          color: #ff8080;
        }

        .how-section {
          text-align: center;
        }

        .how-title {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 800;
          color: var(--fg);
          margin: 0 0 40px;
          letter-spacing: -0.04em;
        }

        .how-steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }

        .how-step {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px 20px;
          text-align: center;
          transition: border-color 0.2s;
        }

        .how-step:hover {
          border-color: rgba(99, 255, 180, 0.3);
        }

        .how-step-icon {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .how-step-label {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--fg);
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .how-step-desc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
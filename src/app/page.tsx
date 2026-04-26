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
              <span className={candidates.length === 0 ? "sample-warning" : "char-count"}>
                {candidates.length === 0 ? "⚠ Using 15 sample candidates" : `${candidates.length} candidates in pool`}
              </span>
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
              { icon: "🔍", label: "Candidate Discovery", desc: "Semantic matching across candidate profiles with explainable insights" },
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
    </div>
  );
}
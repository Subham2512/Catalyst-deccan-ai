"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PipelineResult, RankedCandidate, ChatSession } from "@/types";

interface Props {
  result: PipelineResult;
  onReset: () => void;
}

// ─── LiveChat component shown inside the dashboard conversation tab ──────────

function LiveChat({ candidate, onScoreUpdate }: { candidate: RankedCandidate; onScoreUpdate: (token: string, score: number) => void }) {
  const [session, setSession] = useState<ChatSession | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const token = candidate.chatToken;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const chatUrl = `${appUrl}/chat/${token}`;

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${token}`);
      if (res.ok) {
        const { session } = await res.json();
        setSession(session);
        if (session.interestScore > 0) onScoreUpdate(token, session.interestScore);
      }
    } catch { /* silent */ }
  }, [token, onScoreUpdate]);

  useEffect(() => {
    fetchSession();
    // Poll every 5 seconds while conversation is open
    const id = setInterval(() => {
      if (session?.status === "closed") return;
      fetchSession();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchSession, session?.status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages?.length]);

  const copyLink = () => {
    navigator.clipboard.writeText(chatUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const messages = session?.messages ?? candidate.conversation;
  const status = session?.status ?? "waiting";
  const interestScore = session?.interestScore ?? candidate.interestScore;

  return (
    <div className="conversation-view">
      {/* Link banner */}
      <div style={{
        background: "rgba(99,102,241,0.08)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap" as const,
      }}>
        <span style={{ fontSize: 13, color: "#94a3b8", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          🔗 {chatUrl}
        </span>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={copyLink} style={{
            background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
            color: copied ? "#4ade80" : "#94a3b8",
            padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 500,
          }}>
            {copied ? "✓ Copied" : "Copy Link"}
          </button>
          <a href={chatUrl} target="_blank" rel="noreferrer" style={{
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            color: "#a5b4fc", padding: "5px 12px", borderRadius: 6, fontSize: 12, textDecoration: "none", fontWeight: 500,
          }}>
            Open ↗
          </a>
        </div>
      </div>

      {/* Status row */}
      <div className="conv-meta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          {messages.length} message{messages.length !== 1 ? "s" : ""} ·{" "}
          <span style={{ color: status === "closed" ? "#64748b" : status === "active" ? "#4ade80" : "#fbbf24" }}>
            {status === "waiting" ? "Awaiting reply" : status === "active" ? "Active" : "Closed"}
          </span>
        </span>
        {interestScore > 0 && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Interest score: <strong style={{ color: interestScore >= 70 ? "#4ade80" : interestScore >= 45 ? "#f5c842" : "#ff6b6b" }}>{interestScore}</strong>
          </span>
        )}
      </div>

      {/* Thread */}
      <div className="conv-thread">
        {messages.map((msg, i) => (
          <div key={i} className={`conv-message ${msg.role}`}>
            <div className="conv-avatar">
              {msg.role === "recruiter" ? "R" : candidate.candidate.name[0]}
            </div>
            <div className="conv-bubble">
              <div className="conv-sender">
                {msg.role === "recruiter" ? "Recruiter" : candidate.candidate.name}
                {"timestamp" in msg && msg.timestamp && (
                  <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.6 }}>
                    · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <div className="conv-text">{msg.content}</div>
            </div>
          </div>
        ))}
        {status === "waiting" && (
          <div style={{ textAlign: "center" as const, color: "#475569", fontSize: 12, padding: "12px 0" }}>
            Waiting for {candidate.candidate.name.split(" ")[0]} to reply...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Interest signals if available */}
      {(session?.interestSignals?.length ?? 0) > 0 && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Interest Signals</div>
          {session!.interestSignals.map((s, i) => <div key={i} style={{ fontSize: 12, color: "#86efac", marginTop: 3 }}>✓ {s}</div>)}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard({ result, onReset }: Props) {
  if (!result) return null;
  const { parsedJD, rankedCandidates } = result;

  // Read initial candidate + tab from URL on mount
  const initialCandidate = (() => {
    if (typeof window === "undefined") return rankedCandidates[0] ?? null;
    const id = new URLSearchParams(window.location.search).get("c");
    return rankedCandidates.find((rc) => rc.candidate.id === id) ?? rankedCandidates[0] ?? null;
  })();
  const initialTab = (() => {
    if (typeof window === "undefined") return "overview";
    const t = new URLSearchParams(window.location.search).get("tab");
    return (["overview", "conversation", "analysis"].includes(t ?? "") ? t : "overview") as "overview" | "conversation" | "analysis";
  })();

  const [selectedCandidate, setSelectedCandidate] = useState<RankedCandidate | null>(initialCandidate);
  const [activeTab, setActiveTab] = useState<"overview" | "conversation" | "analysis">(initialTab);
  const [liveScores, setLiveScores] = useState<Record<string, number>>({});

  // Keep URL in sync — ?c=candidateId&tab=tabName
  const syncUrl = useCallback((candidateId: string, tab: string) => {
    const params = new URLSearchParams({ c: candidateId, tab });
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const selectCandidate = useCallback((rc: RankedCandidate) => {
    setSelectedCandidate(rc);
    syncUrl(rc.candidate.id, activeTab);
  }, [activeTab, syncUrl]);

  const selectTab = useCallback((tab: "overview" | "conversation" | "analysis") => {
    setActiveTab(tab);
    if (selectedCandidate) syncUrl(selectedCandidate.candidate.id, tab);
  }, [selectedCandidate, syncUrl]);

  const updateScore = useCallback((token: string, score: number) => {
    setLiveScores((prev) => (prev[token] === score ? prev : { ...prev, [token]: score }));
  }, []);

  // Use live score if available, else fall back to pipeline score
  const getInterest = (rc: RankedCandidate) => liveScores[rc.chatToken] ?? rc.interestScore;
  const getCombined = (rc: RankedCandidate) => {
    const i = getInterest(rc);
    return Math.round(rc.matchScore * 0.55 + i * 0.45);
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "var(--accent)";
    if (score >= 55) return "#f5c842";
    return "#ff6b6b";
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return "rgba(99, 255, 180, 0.1)";
    if (score >= 55) return "rgba(245, 200, 66, 0.1)";
    return "rgba(255, 107, 107, 0.1)";
  };

  const getAvailabilityLabel = (avail: string) => {
    const map: Record<string, string> = {
      immediately: "Available Now",
      "2_weeks": "2 Weeks Notice",
      "1_month": "1 Month Notice",
      "3_months": "3 Months Notice",
      not_looking: "Not Looking",
    };
    return map[avail] ?? avail;
  };

  const getAvailabilityColor = (avail: string) => {
    if (avail === "immediately") return "var(--accent)";
    if (avail === "2_weeks" || avail === "1_month") return "#f5c842";
    return "#ff6b6b";
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-logo" onClick={() => { window.history.replaceState(null, "", "/"); onReset(); }} style={{ cursor: "pointer" }}>
            <span>⚡</span>
            <span className="dash-logo-text">Catalyst</span>
          </div>
          <div className="jd-summary">
            <span className="jd-role">{parsedJD.title}</span>
            <span className="jd-meta">
              {parsedJD.seniorityLevel} · {parsedJD.location} · {parsedJD.salaryRange}
            </span>
          </div>
          <button className="new-search-btn" onClick={() => { window.history.replaceState(null, "", "/"); onReset(); }}>
            ← New Search
          </button>
        </div>
      </header>

      <div className="dash-body">
        {/* Left panel: ranked list */}
        <aside className="candidates-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              Shortlist
              <span className="panel-count">{rankedCandidates.length}</span>
            </h2>
            <div className="score-legend">
              <span className="legend-item">
                <span className="legend-dot match" />Match
              </span>
              <span className="legend-item">
                <span className="legend-dot interest" />Interest
              </span>
            </div>
          </div>

          <div className="candidates-list">
            {rankedCandidates.map((rc, index) => (
              <button
                key={rc.candidate.id}
                className={`candidate-card ${selectedCandidate?.candidate.id === rc.candidate.id ? "selected" : ""}`}
                onClick={() => selectCandidate(rc)}
              >
                <div className="candidate-rank">#{index + 1}</div>
                <div className="candidate-info">
                  <div className="candidate-name">{rc.candidate.name}</div>
                  <div className="candidate-title">{rc.candidate.title}</div>
                  <div className="candidate-location">
                    <span>{rc.candidate.location}</span>
                    <span
                      className="availability-badge"
                      style={{ color: getAvailabilityColor(rc.candidate.availability) }}
                    >
                      {getAvailabilityLabel(rc.candidate.availability)}
                    </span>
                  </div>
                </div>
                <div className="candidate-scores">
                  <div className="combined-score-display" style={{ color: getScoreColor(getCombined(rc)) }}>
                    {getCombined(rc)}
                  </div>
                  <div className="score-mini-row">
                    <span className="score-mini match-color">{rc.matchScore}M</span>
                    <span className="score-mini interest-color">{getInterest(rc)}I</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Right panel: candidate detail */}
        {selectedCandidate && (
          <main className="detail-panel">
            {/* Candidate header */}
            <div className="detail-header">
              <div className="detail-avatar">
                {selectedCandidate.candidate.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div className="detail-meta">
                <h2 className="detail-name">{selectedCandidate.candidate.name}</h2>
                <div className="detail-title">{selectedCandidate.candidate.title}</div>
                <div className="detail-sub">
                  {selectedCandidate.candidate.location} ·{" "}
                  {selectedCandidate.candidate.yearsExperience} years exp ·{" "}
                  {selectedCandidate.candidate.salaryExpectation}
                </div>
                <div className="detail-companies">
                  {selectedCandidate.candidate.previousCompanies.map((c) => (
                    <span key={c} className="company-badge">{c}</span>
                  ))}
                </div>
              </div>
              <div className="detail-scores-col">
                <div className="score-block">
                  <div
                    className="score-big"
                    style={{
                      color: getScoreColor(getCombined(selectedCandidate)),
                      background: getScoreBg(getCombined(selectedCandidate)),
                    }}
                  >
                    {getCombined(selectedCandidate)}
                  </div>
                  <div className="score-big-label">Combined</div>
                </div>
                <div className="score-pair">
                  <div className="score-small">
                    <div className="score-small-num match-color">{selectedCandidate.matchScore}</div>
                    <div className="score-small-label">Match</div>
                  </div>
                  <div className="score-small">
                    <div className="score-small-num interest-color">{getInterest(selectedCandidate)}</div>
                    <div className="score-small-label">Interest</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Score bars */}
            <div className="score-bars">
              <div className="score-bar-row">
                <span className="score-bar-label">Match Score (55%)</span>
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill match-fill"
                    style={{ width: `${selectedCandidate.matchScore}%` }}
                  />
                </div>
                <span className="score-bar-num">{selectedCandidate.matchScore}</span>
              </div>
              <div className="score-bar-row">
                <span className="score-bar-label">Interest Score (45%)</span>
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill interest-fill"
                    style={{ width: `${getInterest(selectedCandidate)}%`, transition: "width 0.6s ease" }}
                  />
                </div>
                <span className="score-bar-num">{getInterest(selectedCandidate)}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {(["overview", "conversation", "analysis"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => selectTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="tab-content">
              {activeTab === "overview" && (
                <div className="overview-grid">
                  <div className="info-card">
                    <h3 className="info-card-title">Skills Match</h3>
                    <div className="skills-list">
                      {selectedCandidate.candidate.skills.map((skill) => {
                        const isRequired = parsedJD.requiredSkills.some((s) =>
                          s.toLowerCase() === skill.toLowerCase()
                        );
                        const isNiceToHave = parsedJD.niceToHaveSkills.some((s) =>
                          s.toLowerCase() === skill.toLowerCase()
                        );
                        return (
                          <span
                            key={skill}
                            className={`skill-badge ${isRequired ? "skill-required" : isNiceToHave ? "skill-nice" : "skill-other"}`}
                          >
                            {isRequired && "✓ "}
                            {skill}
                          </span>
                        );
                      })}
                    </div>
                    {selectedCandidate.missingSkills.length > 0 && (
                      <div className="missing-skills">
                        <div className="missing-label">Missing:</div>
                        {selectedCandidate.missingSkills.map((s) => (
                          <span key={s} className="skill-badge skill-missing">✗ {s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="info-card">
                    <h3 className="info-card-title">Strengths</h3>
                    <ul className="signal-list">
                      {selectedCandidate.strengths.map((s, i) => (
                        <li key={i} className="signal-item positive">
                          <span className="signal-icon">↑</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {selectedCandidate.concerns.length > 0 && (
                    <div className="info-card">
                      <h3 className="info-card-title">Concerns</h3>
                      <ul className="signal-list">
                        {selectedCandidate.concerns.map((c, i) => (
                          <li key={i} className="signal-item warning">
                            <span className="signal-icon">!</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="info-card full-width">
                    <h3 className="info-card-title">Interest Summary</h3>
                    <p className="interest-summary-text">{selectedCandidate.interestSummary}</p>
                    {selectedCandidate.interestSignals.length > 0 && (
                      <div className="signals-row">
                        {selectedCandidate.interestSignals.map((s, i) => (
                          <span key={i} className="signal-chip positive-chip">{s}</span>
                        ))}
                        {selectedCandidate.redFlags.map((s, i) => (
                          <span key={i} className="signal-chip red-chip">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "conversation" && (
                <LiveChat candidate={selectedCandidate} onScoreUpdate={updateScore} />
              )}

              {activeTab === "analysis" && (
                <div className="analysis-view">
                  <div className="info-card">
                    <h3 className="info-card-title">Why This Candidate Matched</h3>
                    <ul className="signal-list">
                      {selectedCandidate.matchReasons.map((r, i) => (
                        <li key={i} className="signal-item positive">
                          <span className="signal-icon">✓</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="info-card">
                    <h3 className="info-card-title">Score Breakdown</h3>
                    <div className="breakdown-table">
                      <div className="breakdown-row">
                        <span>Skills Alignment (40% of match)</span>
                        <span className="match-color">{Math.round(selectedCandidate.matchScore * 0.4)}/40</span>
                      </div>
                      <div className="breakdown-row">
                        <span>Experience Level (25% of match)</span>
                        <span className="match-color">{Math.round(selectedCandidate.matchScore * 0.25)}/25</span>
                      </div>
                      <div className="breakdown-row">
                        <span>Role Relevance (20% of match)</span>
                        <span className="match-color">{Math.round(selectedCandidate.matchScore * 0.2)}/20</span>
                      </div>
                      <div className="breakdown-row">
                        <span>Education & Background (15% of match)</span>
                        <span className="match-color">{Math.round(selectedCandidate.matchScore * 0.15)}/15</span>
                      </div>
                      <div className="breakdown-divider" />
                      <div className="breakdown-row total">
                        <span>Match Score Total</span>
                        <span className="match-color">{selectedCandidate.matchScore}/100</span>
                      </div>
                      <div className="breakdown-row total">
                        <span>Interest Score Total</span>
                        <span className="interest-color">{getInterest(selectedCandidate)}/100</span>
                      </div>
                      <div className="breakdown-divider" />
                      <div className="breakdown-row total combined">
                        <span>Combined Score (55% + 45%)</span>
                        <span>{getCombined(selectedCandidate)}/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="info-card">
                    <h3 className="info-card-title">Candidate Profile</h3>
                    <div className="profile-data">
                      <div className="profile-row">
                        <span className="profile-label">Education</span>
                        <span className="profile-value">{selectedCandidate.candidate.education}</span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Salary Ask</span>
                        <span className="profile-value">{selectedCandidate.candidate.salaryExpectation}</span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">JD Range</span>
                        <span className="profile-value">{parsedJD.salaryRange}</span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Availability</span>
                        <span
                          className="profile-value"
                          style={{ color: getAvailabilityColor(selectedCandidate.candidate.availability) }}
                        >
                          {getAvailabilityLabel(selectedCandidate.candidate.availability)}
                        </span>
                      </div>
                      <div className="profile-row">
                        <span className="profile-label">Summary</span>
                        <span className="profile-value">{selectedCandidate.candidate.summary}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          font-family: var(--font-body);
        }

        .dash-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(8, 8, 12, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }

        .dash-header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
          height: 60px;
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .dash-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 800;
          color: var(--fg);
          letter-spacing: -0.03em;
        }

        .jd-summary {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .jd-role {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: var(--fg);
          letter-spacing: -0.02em;
        }

        .jd-meta {
          font-size: 13px;
          color: var(--muted);
        }

        .new-search-btn {
          font-size: 13px;
          color: var(--muted);
          background: none;
          border: 1px solid var(--border);
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.2s;
        }
        .new-search-btn:hover {
          color: var(--fg);
          border-color: var(--fg);
        }

        .dash-body {
          display: flex;
          flex: 1;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
          padding: 0 24px;
          gap: 0;
        }

        /* Candidates panel */
        .candidates-panel {
          width: 320px;
          min-width: 320px;
          border-right: 1px solid var(--border);
          padding: 24px 0;
          overflow-y: auto;
          max-height: calc(100vh - 60px);
          position: sticky;
          top: 60px;
        }

        .panel-header {
          padding: 0 20px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          margin-bottom: 8px;
        }

        .panel-title {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
          color: var(--fg);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: -0.02em;
        }

        .panel-count {
          background: rgba(99, 255, 180, 0.1);
          color: var(--accent);
          border: 1px solid rgba(99, 255, 180, 0.2);
          font-size: 11px;
          padding: 1px 7px;
          border-radius: 99px;
          font-weight: 600;
        }

        .score-legend {
          display: flex;
          gap: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--muted);
        }

        .legend-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .legend-dot.match { background: #63ffb4; }
        .legend-dot.interest { background: #63b4ff; }

        .candidates-list {
          display: flex;
          flex-direction: column;
        }

        .candidate-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 20px;
          border: none;
          border-bottom: 1px solid var(--border);
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
          width: 100%;
        }

        .candidate-card:hover {
          background: rgba(255,255,255,0.03);
        }

        .candidate-card.selected {
          background: rgba(99, 255, 180, 0.05);
          border-left: 3px solid var(--accent);
        }

        .candidate-rank {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          min-width: 24px;
          padding-top: 2px;
        }

        .candidate-info {
          flex: 1;
          min-width: 0;
        }

        .candidate-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--fg);
          margin-bottom: 2px;
        }

        .candidate-title {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .candidate-location {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--muted);
        }

        .availability-badge {
          font-size: 10px;
          font-weight: 600;
        }

        .candidate-scores {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .combined-score-display {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .score-mini-row {
          display: flex;
          gap: 6px;
        }

        .score-mini {
          font-size: 10px;
          font-weight: 600;
          opacity: 0.8;
        }

        .match-color { color: #63ffb4; }
        .interest-color { color: #63b4ff; }

        /* Detail panel */
        .detail-panel {
          flex: 1;
          padding: 28px 32px;
          overflow-y: auto;
          max-height: calc(100vh - 60px);
        }

        .detail-header {
          display: flex;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--border);
        }

        .detail-avatar {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: rgba(99, 255, 180, 0.1);
          border: 1px solid rgba(99, 255, 180, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          color: var(--accent);
          flex-shrink: 0;
        }

        .detail-meta {
          flex: 1;
        }

        .detail-name {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 800;
          color: var(--fg);
          margin: 0 0 4px;
          letter-spacing: -0.03em;
        }

        .detail-title {
          font-size: 15px;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .detail-sub {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 10px;
        }

        .detail-companies {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .company-badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--fg);
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 3px 10px;
          border-radius: 6px;
        }

        .detail-scores-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
        }

        .score-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .score-big {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
          width: 72px;
          height: 72px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .score-big-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-weight: 600;
        }

        .score-pair {
          display: flex;
          gap: 12px;
        }

        .score-small {
          text-align: center;
        }

        .score-small-num {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .score-small-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
          font-weight: 600;
        }

        /* Score bars */
        .score-bars {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
        }

        .score-bar-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .score-bar-label {
          font-size: 12px;
          color: var(--muted);
          min-width: 180px;
        }

        .score-bar-track {
          flex: 1;
          height: 6px;
          background: var(--border);
          border-radius: 99px;
          overflow: hidden;
        }

        .score-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.5s ease-out;
        }

        .match-fill { background: #63ffb4; }
        .interest-fill { background: #63b4ff; }

        .score-bar-num {
          font-size: 13px;
          font-weight: 700;
          color: var(--fg);
          min-width: 28px;
          text-align: right;
        }

        /* Tabs */
        .tabs {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 24px;
        }

        .tab {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: var(--muted);
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          cursor: pointer;
          font-family: var(--font-body);
          transition: all 0.15s;
          text-transform: capitalize;
        }

        .tab:hover { color: var(--fg); }

        .tab.active {
          color: var(--accent);
          border-bottom-color: var(--accent);
        }

        /* Overview grid */
        .overview-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .info-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px;
        }

        .info-card.full-width {
          grid-column: 1 / -1;
        }

        .info-card-title {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          color: var(--fg);
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          opacity: 0.7;
        }

        .skills-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .skill-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 6px;
        }

        .skill-required {
          color: var(--accent);
          background: rgba(99, 255, 180, 0.1);
          border: 1px solid rgba(99, 255, 180, 0.2);
        }

        .skill-nice {
          color: #f5c842;
          background: rgba(245, 200, 66, 0.1);
          border: 1px solid rgba(245, 200, 66, 0.2);
        }

        .skill-other {
          color: var(--muted);
          background: var(--border);
          border: 1px solid transparent;
        }

        .skill-missing {
          color: #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.2);
        }

        .missing-skills {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .missing-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 600;
        }

        .signal-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .signal-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
          line-height: 1.4;
        }

        .signal-item.positive { color: var(--fg); }
        .signal-item.warning { color: #f5c842; }

        .signal-icon {
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .signal-item.positive .signal-icon { color: var(--accent); }
        .signal-item.warning .signal-icon { color: #f5c842; }

        .interest-summary-text {
          font-size: 14px;
          color: var(--muted);
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .signals-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .signal-chip {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 10px;
          border-radius: 99px;
        }

        .positive-chip {
          color: var(--accent);
          background: rgba(99, 255, 180, 0.1);
          border: 1px solid rgba(99, 255, 180, 0.2);
        }

        .red-chip {
          color: #ff6b6b;
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.2);
        }

        /* Conversation */
        .conversation-view {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .conv-meta {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
        }

        .conv-thread {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .conv-message {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .conv-message.candidate {
          flex-direction: row-reverse;
        }

        .conv-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--surface);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          flex-shrink: 0;
        }

        .conv-message.recruiter .conv-avatar {
          background: rgba(99, 255, 180, 0.1);
          color: var(--accent);
          border-color: rgba(99, 255, 180, 0.2);
        }

        .conv-bubble {
          max-width: 75%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 16px;
        }

        .conv-message.recruiter .conv-bubble {
          border-color: rgba(99, 255, 180, 0.15);
          background: rgba(99, 255, 180, 0.04);
        }

        .conv-sender {
          font-size: 11px;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .conv-text {
          font-size: 14px;
          color: var(--fg);
          line-height: 1.6;
        }

        /* Analysis */
        .analysis-view {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .breakdown-table {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .breakdown-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: var(--muted);
          padding: 4px 0;
        }

        .breakdown-row.total {
          font-weight: 600;
          color: var(--fg);
        }

        .breakdown-row.combined {
          font-size: 15px;
        }

        .breakdown-divider {
          border-top: 1px solid var(--border);
          margin: 4px 0;
        }

        .profile-data {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .profile-row {
          display: flex;
          gap: 16px;
          font-size: 13px;
        }

        .profile-label {
          color: var(--muted);
          min-width: 100px;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.05em;
          padding-top: 2px;
        }

        .profile-value {
          color: var(--fg);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
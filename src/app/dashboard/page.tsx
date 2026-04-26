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
    </div>
  );
}
"use client";

import { useState, useEffect, useRef, use } from "react";
import { ChatSession } from "@/types";

export default function CandidateChatPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = use(params);
    const [session, setSession] = useState<ChatSession | null>(null);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    const fetchSession = async () => {
        try {
            const res = await fetch(`/api/chat/${token}`);
            if (!res.ok) { setError("Conversation not found."); return; }
            const { session } = await res.json();
            setSession(session);
        } catch {
            setError("Failed to load conversation.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchSession(); }, [token]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [session?.messages]);

    const send = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        const msg = input.trim();
        setInput("");

        // Optimistically append candidate message immediately
        const optimisticMsg = { role: "candidate" as const, content: msg, timestamp: new Date().toISOString() };
        setSession((prev) => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev);

        try {
            const res = await fetch(`/api/chat/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Something went wrong."); return; }
            setSession(data.session);
        } catch {
            setError("Failed to send. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    if (loading) return (
        <div style={styles.center}>
            <div style={styles.spinner} />
            <p style={{ color: "#64748b", marginTop: 16 }}>Loading your conversation...</p>
        </div>
    );

    if (error || !session) return (
        <div style={styles.center}>
            <div style={{ fontSize: 48 }}>😕</div>
            <p style={{ color: "#f87171", marginTop: 12 }}>{error || "Conversation not found."}</p>
        </div>
    );

    const isWaiting = session.status === "waiting";
    const isClosed = session.status === "closed";
    const canReply = !isClosed && !sending;

    return (
        <div style={styles.page}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerInner}>
                    <div style={styles.logo}>⚡ Catalyst</div>
                    <div style={styles.headerMeta}>
                        <div style={styles.roleLabel}>
                            {session.parsedJD.title}
                        </div>
                        <div style={styles.statusBadge(session.status)}>
                            {session.status === "waiting" ? "● Awaiting your reply"
                                : session.status === "active" ? "● Active"
                                    : "✓ Closed"}
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat thread */}
            <main style={styles.main}>
                <div style={styles.thread}>
                    {/* Context banner */}
                    <div style={styles.contextBanner}>
                        <span style={styles.contextIcon}>💼</span>
                        <div>
                            <div style={styles.contextTitle}>{session.parsedJD.title}</div>
                            <div style={styles.contextSub}>
                                {session.parsedJD.companyType} · {session.parsedJD.location}
                                {session.parsedJD.remote ? " (Remote OK)" : ""} · {session.parsedJD.salaryRange}
                            </div>
                        </div>
                    </div>

                    {session.messages.map((msg, i) => {
                        const isRecruiter = msg.role === "recruiter";
                        return (
                            <div key={i} style={styles.messageRow(isRecruiter)}>
                                <div style={styles.avatar(isRecruiter)}>
                                    {isRecruiter ? "R" : session.candidate.name[0]}
                                </div>
                                <div style={styles.bubbleWrap(isRecruiter)}>
                                    <div style={styles.sender}>
                                        {isRecruiter ? "Recruiter" : "You"} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                    <div style={styles.bubble(isRecruiter)}>{msg.content}</div>
                                </div>
                            </div>
                        );
                    })}

                    {sending && (
                        <div style={styles.messageRow(true)}>
                            <div style={styles.avatar(true)}>R</div>
                            <div style={styles.bubbleWrap(true)}>
                                <div style={styles.bubble(true)}>
                                    <span style={styles.typingDot} /><span style={styles.typingDot} /><span style={styles.typingDot} />
                                </div>
                            </div>
                        </div>
                    )}

                    {isClosed && (
                        <div style={styles.closedBanner}>
                            This conversation has concluded. Thank you for your time, {session.candidate.name.split(" ")[0]}.
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </main>

            {/* Input */}
            {!isClosed && (
                <footer style={styles.footer}>
                    <div style={styles.inputRow}>
                        <textarea
                            style={styles.textarea}
                            placeholder={isWaiting ? "Type your reply..." : "Continue the conversation..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            rows={3}
                            disabled={!canReply}
                        />
                        <button
                            style={styles.sendBtn(canReply && !!input.trim())}
                            onClick={send}
                            disabled={!canReply || !input.trim()}
                        >
                            {sending ? "..." : "Send"}
                        </button>
                    </div>
                    <div style={styles.hint}>Press Enter to send · Shift+Enter for new line</div>
                </footer>
            )}

            <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0; }
          40% { opacity: 1; }
        }
      `}</style>
        </div>
    );
}

// ─── styles ────────────────────────────────────────────────────────────────

const styles = {
    page: {
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column" as const,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    center: {
        minHeight: "100vh",
        background: "#0a0f1e",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, sans-serif",
    },
    spinner: {
        width: 36,
        height: 36,
        border: "3px solid rgba(99,102,241,0.2)",
        borderTopColor: "#6366f1",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
    },
    header: {
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 20px",
        position: "sticky" as const,
        top: 0,
        zIndex: 10,
        backdropFilter: "blur(12px)",
    },
    headerInner: {
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    logo: {
        fontWeight: 700,
        fontSize: 18,
        color: "#f1f5f9",
        letterSpacing: "-0.02em",
    },
    headerMeta: {
        display: "flex",
        alignItems: "center",
        gap: 12,
    },
    roleLabel: {
        fontSize: 13,
        color: "#94a3b8",
        fontWeight: 500,
    },
    statusBadge: (status: string) => ({
        fontSize: 11,
        padding: "3px 10px",
        borderRadius: 20,
        fontWeight: 600,
        background: status === "closed"
            ? "rgba(100,116,139,0.15)"
            : status === "active"
                ? "rgba(74,222,128,0.12)"
                : "rgba(251,191,36,0.12)",
        color: status === "closed" ? "#64748b"
            : status === "active" ? "#4ade80"
                : "#fbbf24",
    }),
    main: {
        flex: 1,
        overflowY: "auto" as const,
        padding: "24px 20px",
    },
    thread: {
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column" as const,
        gap: 20,
    },
    contextBanner: {
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "rgba(99,102,241,0.08)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 8,
    },
    contextIcon: { fontSize: 22 },
    contextTitle: { fontWeight: 600, fontSize: 15, color: "#f1f5f9" },
    contextSub: { fontSize: 12, color: "#94a3b8", marginTop: 3 },
    messageRow: (isRecruiter: boolean) => ({
        display: "flex",
        gap: 12,
        flexDirection: isRecruiter ? "row" as const : "row-reverse" as const,
        alignItems: "flex-start",
    }),
    avatar: (isRecruiter: boolean) => ({
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: isRecruiter
            ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
            : "linear-gradient(135deg,#0ea5e9,#06b6d4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: 14,
        flexShrink: 0,
    }),
    bubbleWrap: (isRecruiter: boolean) => ({
        maxWidth: "72%",
        display: "flex",
        flexDirection: "column" as const,
        alignItems: isRecruiter ? "flex-start" : "flex-end",
    }),
    sender: {
        fontSize: 11,
        color: "#475569",
        marginBottom: 4,
    },
    bubble: (isRecruiter: boolean) => ({
        background: isRecruiter
            ? "rgba(255,255,255,0.05)"
            : "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3))",
        border: `1px solid ${isRecruiter ? "rgba(255,255,255,0.07)" : "rgba(99,102,241,0.3)"}`,
        borderRadius: isRecruiter ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        padding: "10px 14px",
        fontSize: 14,
        color: "#f1f5f9",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap" as const,
    }),
    typingDot: {
        display: "inline-block",
        width: 6,
        height: 6,
        background: "#64748b",
        borderRadius: "50%",
        margin: "0 2px",
        animation: "blink 1.2s infinite",
    },
    closedBanner: {
        textAlign: "center" as const,
        fontSize: 13,
        color: "#64748b",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "14px 20px",
    },
    footer: {
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,15,30,0.95)",
        backdropFilter: "blur(12px)",
        padding: "16px 20px",
        position: "sticky" as const,
        bottom: 0,
    },
    inputRow: {
        maxWidth: 720,
        margin: "0 auto",
        display: "flex",
        gap: 10,
        alignItems: "flex-end",
    },
    textarea: {
        flex: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        padding: "10px 14px",
        color: "#f1f5f9",
        fontSize: 14,
        resize: "none" as const,
        outline: "none",
        fontFamily: "inherit",
        lineHeight: 1.5,
    },
    sendBtn: (active: boolean) => ({
        padding: "10px 20px",
        background: active ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
        border: "none",
        borderRadius: 12,
        color: active ? "#fff" : "#475569",
        fontWeight: 600,
        fontSize: 14,
        cursor: active ? "pointer" : "not-allowed",
        transition: "all 0.2s",
        whiteSpace: "nowrap" as const,
    }),
    hint: {
        maxWidth: 720,
        margin: "6px auto 0",
        fontSize: 11,
        color: "#334155",
        textAlign: "center" as const,
    },
};
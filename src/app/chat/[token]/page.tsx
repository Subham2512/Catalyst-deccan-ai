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
            if (!res.ok) {
                setError("Conversation not found.");
                return;
            }
            const { session } = await res.json();
            setSession(session);
        } catch {
            setError("Failed to load conversation.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSession();
    }, [token]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [session?.messages]);

    const send = async () => {
        if (!input.trim() || sending) return;

        setSending(true);
        const msg = input.trim();
        setInput("");

        // optimistic update
        const optimisticMsg = {
            role: "candidate" as const,
            content: msg,
            timestamp: new Date().toISOString(),
        };

        setSession((prev) =>
            prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev
        );

        try {
            const res = await fetch(`/api/chat/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Something went wrong.");
                return;
            }

            setSession(data.session);
        } catch {
            setError("Failed to send. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    if (loading) {
        return (
            <div className="chat-center">
                <div className="spinner" />
                <p className="loading-text">Loading your conversation...</p>
            </div>
        );
    }

    if (error || !session) {
        return (
            <div className="chat-center">
                <div className="error-emoji">😕</div>
                <p className="error-text">
                    {error || "Conversation not found."}
                </p>
            </div>
        );
    }

    const isClosed = session.status === "closed";
    const canReply = !isClosed && !sending;

    return (
        <div className="chat-page">
            {/* Header */}
            <header className="chat-header">
                <div className="chat-header-inner">
                    <div className="logo">⚡ Catalyst</div>

                    <div className="header-meta">
                        <div className="role-label">{session.parsedJD.title}</div>

                        <div className={`status ${session.status}`}>
                            {session.status === "waiting"
                                ? "● Awaiting your reply"
                                : session.status === "active"
                                    ? "● Active"
                                    : "✓ Closed"}
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat */}
            <main className="chat-main">
                <div className="chat-thread">
                    {/* Context */}
                    <div className="context-banner">
                        <span className="context-icon">💼</span>
                        <div>
                            <div className="context-title">
                                {session.parsedJD.title}
                            </div>
                            <div className="context-sub">
                                {session.parsedJD.companyType} ·{" "}
                                {session.parsedJD.location}
                                {session.parsedJD.remote ? " (Remote OK)" : ""} ·{" "}
                                {session.parsedJD.salaryRange}
                            </div>
                        </div>
                    </div>

                    {/* Messages */}
                    {session.messages.map((msg, i) => {
                        const isRecruiter = msg.role === "recruiter";

                        return (
                            <div
                                key={i}
                                className={`message-row ${isRecruiter ? "recruiter" : "candidate"
                                    }`}
                            >
                                <div
                                    className={`avatar ${isRecruiter ? "recruiter" : "candidate"
                                        }`}
                                >
                                    {isRecruiter
                                        ? "R"
                                        : session.candidate.name[0]}
                                </div>

                                <div className="bubble-wrap">
                                    <div className="sender">
                                        {isRecruiter ? "Recruiter" : "You"} ·{" "}
                                        {new Date(msg.timestamp).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </div>

                                    <div
                                        className={`bubble ${isRecruiter ? "recruiter" : "candidate"
                                            }`}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Typing */}
                    {sending && (
                        <div className="message-row recruiter">
                            <div className="avatar recruiter">R</div>
                            <div className="bubble-wrap">
                                <div className="bubble recruiter typing">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Closed */}
                    {isClosed && (
                        <div className="closed-banner">
                            This conversation has concluded. Thank you for your
                            time, {session.candidate.name.split(" ")[0]}.
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </main>

            {/* Input */}
            {!isClosed && (
                <footer className="chat-footer">
                    <div className="input-row">
                        <textarea
                            className="chat-textarea"
                            placeholder="Type your reply..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            rows={3}
                            disabled={!canReply}
                        />

                        <button
                            className={`send-btn ${canReply && input.trim() ? "active" : ""
                                }`}
                            onClick={send}
                            disabled={!canReply || !input.trim()}
                        >
                            {sending ? "..." : "Send"}
                        </button>
                    </div>

                    <div className="hint">
                        Press Enter to send · Shift+Enter for new line
                    </div>
                </footer>
            )}
        </div>
    );
}


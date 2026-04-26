/**
 * src/lib/store.ts
 *
 * In-memory chat session store. Survives the process lifetime (fine for dev
 * and single-instance deploys). For production swap the Map with Redis/Upstash:
 *   await redis.set(`session:${token}`, JSON.stringify(session))
 *   await redis.get(`session:${token}`)
 */

import { ChatSession } from "@/types";

// Use a global to survive Next.js hot-reload in dev
const g = globalThis as typeof globalThis & { __chatSessions?: Map<string, ChatSession> };
if (!g.__chatSessions) g.__chatSessions = new Map();
const sessions = g.__chatSessions;

export function getSession(token: string): ChatSession | undefined {
    return sessions.get(token);
}

export function saveSession(session: ChatSession): void {
    sessions.set(session.token, session);
}

export function getAllSessions(): ChatSession[] {
    return Array.from(sessions.values());
}

export function generateToken(): string {
    return Array.from({ length: 3 }, () =>
        Math.random().toString(36).slice(2, 6)
    ).join("-");
}
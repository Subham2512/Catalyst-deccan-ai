import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { getSession, saveSession } from "@/lib/store";
import { ConversationMessage } from "@/types";

// GET — recruiter dashboard polls this for live updates
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const session = getSession(token);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    return NextResponse.json({ session });
}

// POST — candidate sends a reply; AI generates recruiter's next message
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    const session = getSession(token);
    if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (session.status === "closed") {
        return NextResponse.json({ error: "This conversation has been closed." }, { status: 403 });
    }

    const { message }: { message: string } = await req.json();
    if (!message?.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

    const now = new Date().toISOString();

    // Append candidate message
    const candidateMsg: ConversationMessage = {
        role: "candidate",
        content: message.trim(),
        timestamp: now,
    };
    session.messages.push(candidateMsg);
    session.status = "active";
    session.lastActivityAt = now;

    // Build conversation history string for the prompt
    const history = session.messages
        .map((m) => `${m.role === "recruiter" ? "Recruiter" : session.candidate.name}: ${m.content}`)
        .join("\n\n");

    const isLastTurn = session.messages.filter((m) => m.role === "recruiter").length >= 3;

    const prompt = `You are a recruiter having a real conversation with ${session.candidate.name} about a ${session.parsedJD.title} role.

JOB: ${session.parsedJD.title} at ${session.parsedJD.companyType}, ${session.parsedJD.location}
SALARY: ${session.parsedJD.salaryRange}
REQUIRED SKILLS: ${session.parsedJD.requiredSkills.join(", ")}

CONVERSATION SO FAR:
${history}

${isLastTurn
            ? "This is the final message. Wrap up naturally — propose a next step (call/interview) if interest is clear, or respectfully close if not."
            : "Continue the conversation naturally. Respond to what they said. Ask one relevant follow-up question about their experience or interest."}

Keep it under 80 words. Be human, not corporate.

Also analyse the candidate's responses so far and return:
- interestScore: 0-100 (based on their actual words and engagement, not assumptions)
- interestSignals: 1-3 real signals from what they wrote
- redFlags: 0-2 real concerns from what they wrote
- interestSummary: 1 sentence

Return JSON:
{
  "recruiterReply": "message here",
  "interestScore": 72,
  "interestSignals": ["signal one"],
  "redFlags": [],
  "interestSummary": "Candidate seems genuinely interested but has salary concerns."
}`;

    const result = await generateJSON<{
        recruiterReply: string;
        interestScore: number;
        interestSignals: string[];
        redFlags: string[];
        interestSummary: string;
    }>(prompt);

    // Append recruiter reply
    const recruiterMsg: ConversationMessage = {
        role: "recruiter",
        content: result.recruiterReply,
        timestamp: new Date().toISOString(),
    };
    session.messages.push(recruiterMsg);

    // Update interest scoring from real conversation
    session.interestScore = result.interestScore;
    session.interestSignals = result.interestSignals;
    session.redFlags = result.redFlags;
    session.interestSummary = result.interestSummary;
    session.lastActivityAt = new Date().toISOString();

    if (isLastTurn) session.status = "closed";

    saveSession(session);
    return NextResponse.json({ session });
}
import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { generateToken, saveSession } from "@/lib/store";
import { Candidate, ParsedJD, ChatSession } from "@/types";

async function generateOpeningMessage(
    candidate: Candidate,
    parsedJD: ParsedJD,
    matchScore: number
): Promise<string> {
    const prompt = `You are a recruiter writing a first LinkedIn outreach message to a candidate.

ROLE: ${parsedJD.title} at a ${parsedJD.companyType}
LOCATION: ${parsedJD.location}, remote: ${parsedJD.remote}
SALARY: ${parsedJD.salaryRange}
KEY SKILLS NEEDED: ${parsedJD.requiredSkills.slice(0, 4).join(", ")}

CANDIDATE: ${candidate.name}, ${candidate.title}, ${candidate.yearsExperience} years experience
BACKGROUND: ${candidate.previousCompanies.join(", ")}
MATCH SCORE: ${matchScore}/100

Write a short, personalised opening message (3-5 sentences). Reference something specific about their background.
Be direct about the role. End with a clear question to gauge interest.
No generic templates. No "I hope this message finds you well".

Return JSON: { "message": "your message here" }`;

    const result = await generateJSON<{ message: string }>(prompt);
    return result.message;
}

export async function POST(req: NextRequest) {
    try {
        const {
            candidate,
            parsedJD,
            matchScore,
        }: { candidate: Candidate; parsedJD: ParsedJD; matchScore: number } = await req.json();

        const opening = await generateOpeningMessage(candidate, parsedJD, matchScore);
        const token = generateToken();
        const now = new Date().toISOString();

        const session: ChatSession = {
            token,
            candidateId: candidate.id,
            candidate,
            parsedJD,
            matchScore,
            messages: [{ role: "recruiter", content: opening, timestamp: now }],
            interestScore: 0,
            interestSignals: [],
            redFlags: [],
            interestSummary: "Awaiting candidate response",
            status: "waiting",
            createdAt: now,
            lastActivityAt: now,
        };

        saveSession(session);
        return NextResponse.json({ token, session });
    } catch (err) {
        console.error("Create chat error:", err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
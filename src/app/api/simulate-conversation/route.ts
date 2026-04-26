import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { Candidate, ParsedJD, InterestResult } from "@/types";
import { MOCK_CANDIDATES } from "@/data/candidates";

const AVAILABILITY_LABELS: Record<string, string> = {
  immediately: "available immediately",
  "2_weeks": "available with 2 weeks notice",
  "1_month": "available with 1 month notice",
  "3_months": "available with 3 months notice",
  not_looking: "not actively looking",
};

export async function POST(req: NextRequest) {
  try {
    const { candidateId, candidate: bodyCandidate, parsedJD, matchScore }: {
      candidateId: string;
      candidate?: Candidate;
      parsedJD: ParsedJD;
      matchScore: number;
    } = await req.json();

    const candidate = bodyCandidate ?? MOCK_CANDIDATES.find((c) => c.id === candidateId);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const prompt = `Simulate a realistic LinkedIn recruiter outreach conversation between a recruiter and candidate.

ROLE: ${parsedJD.title} at ${parsedJD.companyType}
LOCATION: ${parsedJD.location}, remote: ${parsedJD.remote}
SALARY: ${parsedJD.salaryRange}
KEY SKILLS: ${parsedJD.requiredSkills.slice(0, 4).join(", ")}

CANDIDATE: ${candidate.name}
TITLE: ${candidate.title}
EXPERIENCE: ${candidate.yearsExperience} years
COMPANIES: ${candidate.previousCompanies.join(", ")}
AVAILABILITY: ${AVAILABILITY_LABELS[candidate.availability] ?? candidate.availability}
SALARY EXPECTATION: ${candidate.salaryExpectation}
MATCH SCORE: ${matchScore}/100

Write a 6-message conversation (3 recruiter, 3 candidate). Candidate enthusiasm must reflect their match score and availability.

Return JSON only:
{
  "candidateId": "${candidateId}",
  "interestScore": 72,
  "conversation": [
    { "role": "recruiter", "content": "message text here" },
    { "role": "candidate", "content": "reply text here" },
    { "role": "recruiter", "content": "message text here" },
    { "role": "candidate", "content": "reply text here" },
    { "role": "recruiter", "content": "message text here" },
    { "role": "candidate", "content": "reply text here" }
  ],
  "interestSignals": ["signal one", "signal two"],
  "redFlags": ["flag one"],
  "summary": "One or two sentence summary of candidate interest and fit."
}

Rules:
- interestScore: 85-100 enthusiastic, 65-84 open, 45-64 lukewarm, 25-44 low interest
- Keep each message under 100 words
- No apostrophes in any string values
- No markdown inside strings
- Output raw JSON only`;

    const interestResult = await generateJSON<InterestResult>(prompt, 3);
    return NextResponse.json({ interestResult });
  } catch (err) {
    console.error("Simulation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { Candidate, ParsedJD, MatchResult } from "@/types";
import { MOCK_CANDIDATES } from "@/data/candidates";

async function scoreBatch(batch: Candidate[], parsedJD: ParsedJD): Promise<MatchResult[]> {
  const candidateSummaries = batch.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    yearsExperience: c.yearsExperience,
    skills: c.skills,
    education: c.education,
    previousCompanies: c.previousCompanies,
    summary: c.summary,
    preferredRoles: c.preferredRoles,
    salaryExpectation: c.salaryExpectation,
  }));

  const prompt = `You are a technical recruiter. Score each candidate against this job description.

JOB:
- Title: ${parsedJD.title}
- Required skills: ${parsedJD.requiredSkills.join(", ")}
- Nice to have: ${parsedJD.niceToHaveSkills.join(", ")}
- Experience: ${parsedJD.minExperience}+ years
- Seniority: ${parsedJD.seniorityLevel}
- Location: ${parsedJD.location} (Remote: ${parsedJD.remote})
- Salary: ${parsedJD.salaryRange}
- Company type: ${parsedJD.companyType}

CANDIDATES:
${JSON.stringify(candidateSummaries)}

Return a JSON array with exactly ${batch.length} objects, one per candidate, in the same order:
[
  {
    "candidateId": "c001",
    "matchScore": 85,
    "matchReasons": ["Matched 5 of 6 required skills", "Fintech background at Stripe"],
    "missingSkills": ["Redis"],
    "strengths": ["Strong payments domain experience"],
    "concerns": ["Salary expectation at top of range"]
  }
]

Rules:
- matchScore: integer 0-100. Most score 30-80. Only perfect fits exceed 88.
- matchReasons: 2-3 short strings, no apostrophes, max 60 chars each
- missingSkills: required skills the candidate lacks
- strengths: 1-3 items, max 60 chars each, no apostrophes
- concerns: 0-2 items, max 60 chars each, no apostrophes
- Output raw JSON only, no markdown, no explanation`;

  return generateJSON<MatchResult[]>(prompt, 3);
}

export async function POST(req: NextRequest) {
  try {
    const { parsedJD, candidates: bodyCandidates }: {
      parsedJD: ParsedJD;
      candidates?: Candidate[];
    } = await req.json();

    const candidatePool: Candidate[] =
      Array.isArray(bodyCandidates) && bodyCandidates.length > 0
        ? bodyCandidates
        : MOCK_CANDIDATES;

    const BATCH_SIZE = 5;
    const batches: Candidate[][] = [];
    for (let i = 0; i < candidatePool.length; i += BATCH_SIZE) {
      batches.push(candidatePool.slice(i, i + BATCH_SIZE));
    }

    const batchResults = await Promise.all(batches.map((b) => scoreBatch(b, parsedJD)));

    const sorted = batchResults
      .flat()
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8);

    return NextResponse.json({ matchResults: sorted });
  } catch (err) {
    console.error("Match error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai";
import { ParsedJD } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { jdText } = await req.json();

    if (!jdText || jdText.trim().length < 50) {
      return NextResponse.json({ error: "Job description too short" }, { status: 400 });
    }

    const prompt = `Parse this job description and return structured JSON only.

JOB DESCRIPTION:
${jdText}

Return this exact JSON structure with no markdown and no explanation:
{
  "title": "job title here",
  "requiredSkills": ["skill1", "skill2"],
  "niceToHaveSkills": ["skill1", "skill2"],
  "minExperience": 3,
  "maxExperience": 7,
  "educationRequired": "Bachelor in CS or equivalent",
  "location": "San Francisco CA",
  "remote": true,
  "salaryRange": "$150k - $200k",
  "keyResponsibilities": ["responsibility1", "responsibility2"],
  "companyType": "B2B SaaS startup",
  "seniorityLevel": "Senior"
}

Rules:
- requiredSkills: hard requirements only
- niceToHaveSkills: preferred or bonus skills
- maxExperience: use null if not specified
- remote: true if remote or hybrid mentioned
- salaryRange: "Not specified" if not mentioned
- seniorityLevel: one of Junior, Mid, Senior, Staff, Principal, Manager, Director, VP
- No apostrophes in any string value
- Output raw JSON only`;

    const parsedJD = await generateJSON<ParsedJD>(prompt, 3);
    return NextResponse.json({ parsedJD });
  } catch (err) {
    console.error("JD parse error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
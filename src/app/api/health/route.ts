import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "Catalyst — AI Talent Scouting Agent",
    version: "1.0.0",
    endpoints: [
      "POST /api/parse-jd",
      "POST /api/match-candidates",
      "POST /api/simulate-conversation",
      "POST /api/full-pipeline",
    ],
  });
}

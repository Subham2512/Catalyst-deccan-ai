import { NextRequest } from "next/server";
import { Candidate, ParsedJD, MatchResult, RankedCandidate, PipelineResult, ChatSession } from "@/types";
import { MOCK_CANDIDATES } from "@/data/candidates";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        const { jdText, candidates: bodyCandidates } = await req.json();

        const candidatePool: Candidate[] =
          Array.isArray(bodyCandidates) && bodyCandidates.length > 0
            ? bodyCandidates
            : MOCK_CANDIDATES;

        // Step 1: Parse JD
        send({ step: "parsing", message: "Parsing job description..." });

        const parseRes = await fetch(`${BASE_URL}/api/parse-jd`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jdText }),
        });
        if (!parseRes.ok) throw new Error("Failed to parse JD");
        const { parsedJD }: { parsedJD: ParsedJD } = await parseRes.json();

        send({ step: "parsed", message: "JD parsed successfully", parsedJD });

        // Step 2: Match candidates
        send({ step: "matching", message: "Discovering and scoring candidates..." });

        const matchRes = await fetch(`${BASE_URL}/api/match-candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parsedJD, candidates: candidatePool }),
        });
        if (!matchRes.ok) throw new Error("Failed to match candidates");
        const { matchResults }: { matchResults: MatchResult[] } = await matchRes.json();

        send({ step: "matched", message: `Found ${matchResults.length} matching candidates`, matchResults });

        // Step 3: Create a real chat session for each matched candidate (AI writes opening message)
        const names = matchResults
          .map((m) => candidatePool.find((c) => c.id === m.candidateId)?.name.split(" ")[0])
          .filter(Boolean)
          .join(", ");

        send({
          step: "outreach",
          message: `Creating personalised outreach for ${matchResults.length} candidates: ${names}...`,
          progress: 50,
        });

        const sessionPromises = matchResults.map(async (match) => {
          const candidate = candidatePool.find((c) => c.id === match.candidateId);
          if (!candidate) return null;
          try {
            const res = await fetch(`${BASE_URL}/api/chat/create`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ candidate, parsedJD, matchScore: match.matchScore }),
            });
            if (!res.ok) return null;
            const { session }: { session: ChatSession } = await res.json();
            return { match, session };
          } catch {
            return null;
          }
        });

        const settled = await Promise.allSettled(sessionPromises);
        const created = settled
          .map((r) => (r.status === "fulfilled" ? r.value : null))
          .filter((r): r is { match: MatchResult; session: ChatSession } => r !== null);

        send({
          step: "outreach",
          message: `Outreach ready — ${created.length} candidate chat links created`,
          progress: 100,
        });

        // Step 4: Build ranked shortlist
        // Interest score starts at 0 (no real replies yet); updates live as candidates reply
        const MATCH_WEIGHT = 0.55;
        const INTEREST_WEIGHT = 0.45;

        const rankedCandidates: RankedCandidate[] = created
          .map(({ match, session }) => {
            const candidate = candidatePool.find((c) => c.id === match.candidateId)!;
            const interestScore = session.interestScore;
            const combinedScore = Math.round(
              match.matchScore * MATCH_WEIGHT + interestScore * INTEREST_WEIGHT
            );

            return {
              candidate,
              matchScore: match.matchScore,
              interestScore,
              combinedScore,
              matchReasons: match.matchReasons,
              missingSkills: match.missingSkills,
              strengths: match.strengths,
              concerns: match.concerns,
              chatToken: session.token,
              conversation: session.messages,
              interestSignals: session.interestSignals,
              redFlags: session.redFlags,
              interestSummary: session.interestSummary,
            };
          })
          .sort((a, b) => b.matchScore - a.matchScore); // sort by match until interest comes in

        const result: PipelineResult = {
          parsedJD,
          rankedCandidates,
          processedAt: new Date().toISOString(),
        };

        send({ step: "complete", message: "Pipeline complete! Share links with candidates.", result });
        controller.close();
      } catch (err) {
        send({ step: "error", message: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
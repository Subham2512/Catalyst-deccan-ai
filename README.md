# ⚡ Catalyst — AI Talent Scouting & Engagement Agent

> **Catalyst 2025 Hackathon Submission**
> Paste a Job Description. Get a ranked, scored shortlist of candidates — with simulated outreach conversations — in under 2 minutes.

---

## 🎯 What It Does

Catalyst is an AI-powered talent scouting agent that automates the entire candidate discovery pipeline:

1. **JD Parsing** — Extracts structured requirements from any free-form job description
2. **Candidate Discovery & Matching** — Scores 15 candidates against the JD with explainability
3. **Conversational Outreach Simulation** — Simulates realistic recruiter ↔ candidate conversations via AI
4. **Dual-Score Ranking** — Ranks candidates by combined Match Score + Interest Score

---

## 🏗️ Architecture

```
User Input (JD Text)
       │
       ▼
┌─────────────────────┐
│  /api/parse-jd      │  → Gemini 2.5 Flash extracts: skills, experience,
│  (JD Parser)        │    seniority, salary, location, responsibilities
└─────────┬───────────┘
          │ ParsedJD (structured JSON)
          ▼
┌─────────────────────┐
│ /api/match-candidates│ → Batch-scores all 15 candidates against ParsedJD
│ (Matching Engine)   │   Returns top 8 with match scores + explainability
└─────────┬───────────┘
          │ MatchResult[] (sorted by matchScore)
          ▼
┌─────────────────────┐
│ /api/simulate-      │ → For each top-6 candidate, simulates a 6-8 message
│ conversation        │   LinkedIn/email outreach thread, then scores interest
│ (Outreach Agent)    │
└─────────┬───────────┘
          │ InterestResult[] (with conversation + interest signals)
          ▼
┌─────────────────────┐
│  Ranking Engine     │ → Combined Score = (matchScore × 0.55) + (interestScore × 0.45)
│  (Scoring Logic)    │   Produces final ranked shortlist
└─────────┬───────────┘
          │ RankedCandidate[] (sorted by combinedScore)
          ▼
┌─────────────────────┐
│  Dashboard UI       │ → Recruiter sees: ranked list, score breakdown,
│  (Recruiter View)   │   full conversation, analysis tabs
└─────────────────────┘
```

### Streaming Pipeline
The `/api/full-pipeline` route orchestrates all steps and streams progress events back to the UI via `ReadableStream` — so recruiters see live progress as each step completes.

---

## 📊 Scoring Logic

### Match Score (0–100)
Evaluates skills + experience + role fit. Weighted formula:

| Dimension | Weight | What's Measured |
|-----------|--------|-----------------|
| Skills Alignment | 40% | Required skills overlap, nice-to-have coverage |
| Experience Level | 25% | Years of experience vs. JD requirements, seniority match |
| Role Relevance | 20% | Previous titles, company caliber, career trajectory |
| Education & Background | 15% | Degree level, school prestige, domain relevance |

### Interest Score (0–100)
Derived from simulated AI conversation analysis:

| Range | Interpretation |
|-------|----------------|
| 85–100 | Enthusiastically interested, actively seeking |
| 65–84 | Open and engaged, some hesitation |
| 45–64 | Passive, lukewarm, significant concerns |
| 25–44 | Low interest, happy at current job |
| 0–24 | Declined or clearly not interested |

### Combined Score
```
Combined = (Match × 0.55) + (Interest × 0.45)
```
Match weighted slightly higher — a brilliant but uninterested candidate ranks below a good match who's genuinely excited.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier works)

### Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/catalyst
cd catalyst

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.local.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# 4. Run development server
npm run dev

# 5. Open http://localhost:3000
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel
# Add GEMINI_API_KEY in Vercel environment variables
```

---

## 💻 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| AI Model | Gemini 2.5 Flash |
| Styling | CSS-in-JSX (scoped styles) |
| Hosting | Vercel |
| Fonts | Syne + DM Sans + JetBrains Mono |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── parse-jd/route.ts          # JD parsing endpoint
│   │   ├── match-candidates/route.ts  # Matching engine
│   │   ├── simulate-conversation/route.ts  # Outreach simulator
│   │   └── full-pipeline/route.ts    # Orchestrator (streaming)
│   ├── dashboard/
│   │   └── page.tsx                   # Recruiter dashboard UI
│   ├── page.tsx                       # Landing + JD input
│   ├── layout.tsx
│   └── globals.css
├── data/
│   └── candidates.ts                  # 15 mock candidate profiles
├── lib/
│   └── gemini.ts                      # Gemini API client
└── types/
    └── index.ts                       # TypeScript interfaces
```

---

## 🧪 Sample Input

```
Senior Full Stack Engineer — FinTech Startup

We're a Series B fintech startup building the next generation of embedded finance infrastructure...
Requirements:
- 5+ years of full-stack experience
- React, TypeScript, Node.js
- PostgreSQL and Redis
- AWS or GCP
- Prior fintech/payments experience a strong plus
Compensation: $175,000 – $220,000
Location: San Francisco, CA (Hybrid)
```

### Sample Output (Top Candidate)

```json
{
  "name": "Priya Sharma",
  "matchScore": 87,
  "interestScore": 74,
  "combinedScore": 81,
  "matchReasons": ["6/8 required skills", "Stripe payments background", "Senior-level"],
  "interestSignals": ["Asked about team size", "Mentioned active job search"],
  "redFlags": ["Slightly above salary range"]
}
```

---

## 🎬 Demo Video

[Link to 4-minute demo walkthrough](#)

---

## 👨‍💻 Built By

Subham — Indie developer, builder of [ReelAutopsy](https://reelautopsy.com)

---

## 📄 License

MIT

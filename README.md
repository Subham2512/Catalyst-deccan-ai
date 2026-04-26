# ⚡ Catalyst — AI Talent Scouting & Engagement Agent

> **Catalyst 2025 Hackathon Submission**
> Paste a Job Description. Get a ranked, scored shortlist of candidates — with simulated outreach conversations — in under 2 minutes.

🔗 **[Live Demo](#)** · 📹 **[Demo Video](#)** · 🏗️ **[Architecture](#-architecture)**

---

## 🎯 What It Does

Recruiters spend hours sifting through profiles and chasing candidate interest. Catalyst automates the entire pipeline:

1. **JD Parsing** — AI extracts structured requirements from any free-form job description
2. **Candidate Discovery & Matching** — Scores every candidate in your pool against the JD with full explainability
3. **Conversational Outreach Simulation** — AI simulates realistic recruiter ↔ candidate conversations for all matched candidates in parallel
4. **Dual-Score Ranking** — Ranks candidates by Combined Score = Match Score + Interest Score

The recruiter gets an actionable shortlist they can act on immediately — no manual screening, no chasing responses.

---

## 🏗️ Architecture

```
User Input (JD Text + Candidate Pool)
          │
          ▼
┌──────────────────────┐
│   /api/parse-jd      │  Gemini extracts: skills, seniority, salary,
│   JD Parser          │  location, responsibilities → ParsedJD object
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ /api/match-candidates│  Batch-scores all candidates in groups of 5
│ Matching Engine      │  Returns top 8 with scores + explainability
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ /api/chat/create     │  For each matched candidate, AI writes a
│ Outreach Agent       │  personalised opening message (runs in parallel)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Ranking Engine      │  Combined = (Match × 0.55) + (Interest × 0.45)
│  Scoring Logic       │  Sorted by combined score
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Dashboard UI        │  Ranked list · Score breakdown · Conversation
│  Recruiter View      │  tab · Analysis tab · Match explainability
└──────────────────────┘
```

### Streaming Pipeline

`/api/full-pipeline` orchestrates all steps and streams NDJSON progress events to the UI via `ReadableStream` — recruiters see live status as each step completes.

### Candidate Pool Management

Candidates are managed entirely in the UI — no code editing required. Recruiters can:

- Add candidates manually via a form
- Import from Excel / CSV (drag and drop)
- Paste JSON or CSV directly
- Data persists in `localStorage` across sessions

---

## 📊 Scoring Logic

### Match Score (0–100)

Evaluates skill fit, experience, and role alignment:

| Dimension              | Weight | What's Measured                                          |
| ---------------------- | ------ | -------------------------------------------------------- |
| Skills Alignment       | 40%    | Required skills overlap, nice-to-have coverage           |
| Experience Level       | 25%    | Years of experience vs. JD requirements, seniority match |
| Role Relevance         | 20%    | Previous titles, company caliber, career trajectory      |
| Education & Background | 15%    | Degree level, prestige, domain relevance                 |

### Interest Score (0–100)

Derived from AI-simulated outreach conversation:

| Range  | Interpretation                                |
| ------ | --------------------------------------------- |
| 85–100 | Enthusiastically interested, actively seeking |
| 65–84  | Open and engaged, some hesitation             |
| 45–64  | Passive, lukewarm, significant concerns       |
| 25–44  | Low interest, happy at current role           |
| 0–24   | Declined or clearly not interested            |

### Combined Score

```
Combined = (Match × 0.55) + (Interest × 0.45)
```

Match is weighted slightly higher — a brilliant but uninterested candidate ranks below a strong match who is genuinely excited about the role.

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
# Open .env.local and paste your GOOGLE_GENERATIVE_AI_API_KEY

# 4. Run
npm run dev

# 5. Open http://localhost:3000
```

### Environment Variables

| Variable                       | Description                                 |
| ------------------------------ | ------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Gemini API key from Google AI Studio   |
| `NEXT_PUBLIC_APP_URL`          | Base URL (default: `http://localhost:3000`) |

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add `GOOGLE_GENERATIVE_AI_API_KEY` and `NEXT_PUBLIC_APP_URL` in the Vercel dashboard under Project → Settings → Environment Variables.

---

## 💻 Tech Stack

| Layer        | Technology                        |
| ------------ | --------------------------------- |
| Framework    | Next.js 15 (App Router)           |
| Language     | TypeScript                        |
| AI Model     | Gemini via Vercel AI SDK          |
| AI Client    | `@ai-sdk/google` + `generateText` |
| Styling      | CSS-in-JSX + CSS variables        |
| Excel Import | SheetJS (`xlsx`)                  |
| Hosting      | Vercel                            |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── parse-jd/route.ts              # JD parsing
│   │   ├── match-candidates/route.ts      # Candidate scoring (batched)
│   │   ├── simulate-conversation/route.ts # Outreach simulation
│   │   ├── chat/
│   │   │   ├── create/route.ts            # Create outreach session
│   │   │   └── [token]/route.ts           # Handle candidate replies
│   │   ├── full-pipeline/route.ts         # Streaming orchestrator
│   │   └── health/route.ts               # Health check
│   ├── chat/
│   │   └── [token]/page.tsx              # Candidate-facing chat UI
│   ├── dashboard/
│   │   └── page.tsx                       # Recruiter dashboard
│   ├── page.tsx                           # Landing + JD input
│   ├── layout.tsx
│   └── globals.css
├── components/
│   └── CandidateManager.tsx              # Add / import / manage candidates
├── data/
│   └── candidates.ts                      # Default sample candidate pool
├── lib/
│   ├── ai.ts                              # Gemini client + JSON extraction
│   └── store.ts                           # In-memory chat session store
└── types/
    └── index.ts                           # TypeScript interfaces
```

---

## 🧪 Sample Input / Output

**Input JD (excerpt):**

```
Senior Full Stack Engineer — FinTech Startup
5+ years experience · React, TypeScript, Node.js, PostgreSQL, Redis, AWS
$175,000 – $220,000 · San Francisco, CA (Hybrid)
```

**Output — Top Candidate:**

```json
{
  "name": "Priya Sharma",
  "matchScore": 87,
  "interestScore": 74,
  "combinedScore": 81,
  "matchReasons": [
    "6 of 7 required skills matched",
    "Stripe payments background"
  ],
  "strengths": [
    "Deep payments infrastructure experience",
    "Senior-level at top fintech"
  ],
  "concerns": ["Salary expectation at top of range"],
  "interestSignals": [
    "Asked about team structure",
    "Requested a call this week"
  ],
  "redFlags": ["Mentioned competing offers — move fast"]
}
```

---

## 🎬 Demo Video

[Link to 4-minute demo walkthrough](#)

---

## 👨‍💻 Built By

Subham — Indie developer · [ReelAutopsy](https://reelautopsy.com)

---

## 📄 License

MIT

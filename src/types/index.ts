export interface Candidate {
  id: string;
  name: string;
  title: string;
  location: string;
  yearsExperience: number;
  skills: string[];
  education: string;
  previousCompanies: string[];
  summary: string;
  availability: "immediately" | "2_weeks" | "1_month" | "3_months" | "not_looking";
  preferredRoles: string[];
  salaryExpectation: string;
  linkedinHeadline: string;
}

export interface ParsedJD {
  title: string;
  requiredSkills: string[];
  niceToHaveSkills: string[];
  minExperience: number;
  maxExperience: number | null;
  educationRequired: string;
  location: string;
  remote: boolean;
  salaryRange: string;
  keyResponsibilities: string[];
  companyType: string;
  seniorityLevel: string;
}

export interface MatchResult {
  candidateId: string;
  matchScore: number;
  matchReasons: string[];
  missingSkills: string[];
  strengths: string[];
  concerns: string[];
}

export interface ConversationMessage {
  role: "recruiter" | "candidate";
  content: string;
  timestamp: string;
}

export type ChatStatus = "waiting" | "active" | "closed";

export interface ChatSession {
  token: string;
  candidateId: string;
  candidate: Candidate;
  parsedJD: ParsedJD;
  matchScore: number;
  messages: ConversationMessage[];
  interestScore: number;
  interestSignals: string[];
  redFlags: string[];
  interestSummary: string;
  status: ChatStatus;
  createdAt: string;
  lastActivityAt: string;
}

export interface RankedCandidate {
  candidate: Candidate;
  matchScore: number;
  interestScore: number;
  combinedScore: number;
  matchReasons: string[];
  missingSkills: string[];
  strengths: string[];
  concerns: string[];
  chatToken: string;
  conversation: ConversationMessage[];
  interestSignals: string[];
  redFlags: string[];
  interestSummary: string;
}

export interface PipelineResult {
  parsedJD: ParsedJD;
  rankedCandidates: RankedCandidate[];
  processedAt: string;
}

// Kept for simulate-conversation route backward compat
export interface InterestResult {
  candidateId: string;
  interestScore: number;
  conversation: ConversationMessage[];
  interestSignals: string[];
  redFlags: string[];
  summary: string;
}
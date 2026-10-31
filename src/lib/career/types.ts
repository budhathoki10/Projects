import type { Profile } from "@/lib/model/types";

export type RequirementCategory = "skill" | "experience" | "qualification" | "responsibility";
export type EvidenceStatus = "shown" | "listed" | "missing" | "unclear";
export type AssessedRequirement = { id: string; text: string; quote: string; category: RequirementCategory; priority: "must" | "preferred"; skills: string[]; unprovenSkills: string[]; status: EvidenceStatus; evidence: string[]; explanation: string };
export type CompanySource = { id: string; title: string; url: string; text: string; retrievedAt: string };
export type CompanyResearch = { sources: CompanySource[]; facts: { category: "product" | "technology" | "culture" | "hiring"; sourceId: string; quote: string }[]; warning: string | null };
export type LearningTask = { id: string; requirementIds: string[]; skill: string; priority: "must" | "preferred"; reason: string; steps: string[]; exercise: string; acceptance: string[]; interviewExplanation: string; resources: { title: string; url: string }[]; effort: string };
export type ApplicationAnswer = { question: string; answer: string; needsInput: boolean };
export type ApplicationPlan = {
  version: 1; fingerprint: string; method: "ai" | "local"; createdAt: string;
  requirements: AssessedRequirement[]; fit: { score: number; shown: number; listed: number; missing: number; unclear: number; explanation: string; priority: "apply" | "prepare" | "stretch" };
  expectations: { text: string; quote: string; inferred: boolean }[];
  company: CompanyResearch; roadmap: LearningTask[]; applicationAnswers: ApplicationAnswer[];
};
export type LearningProgress = Record<string, { completed: boolean; evidenceUrl: string; notes: string; updatedAt: string }>;
export type CareerPlanDoc = { _id: string; userId: string; plan: ApplicationPlan; progress: LearningProgress; updatedAt: Date };
export type QuestionKind = "introduction" | "technical" | "project" | "behavioural" | "scenario" | "gap" | "company" | "coding" | "closing";
export type CareerQuestion = { id: string; kind: QuestionKind; question: string; assesses: string; expected: string[]; source: string; difficulty: 1 | 2 | 3; referenceId?: string; coverage?: string[] };
export type MockFeedback = {
  method: "ai" | "checklist"; score: number | null;
  rubric: { criterion: "correctness" | "depth" | "communication" | "confidence" | "relevance"; score: number | null; note: string }[];
  strengths: string[]; improvements: string[]; corrections: string[]; modelAnswer: string; improvedAnswer: string; followUp: string;
  sources?: { title: string; url: string }[];
};
export type MockTurn = { id: string; question: CareerQuestion; answer: string; feedback: MockFeedback | null; followUpDepth: number };
export type MockReport = { overall: number | null; assessedAnswers: number; localAnswers: number; criteria: { criterion: string; score: number | null }[]; strengths: string[]; weaknesses: string[]; nextSteps: string[]; firstHalf: number | null; secondHalf: number | null };
export type MockSessionDoc = { _id: string; userId: string; jobId: string; fingerprint: string; version: number; status: "active" | "complete"; queue: CareerQuestion[]; mainIndex: number; turns: MockTurn[]; report: MockReport | null; createdAt: Date; updatedAt: Date };
export type CareerContext = { profile: Profile; postText: string; post: import("@/lib/model/types").JobPost };

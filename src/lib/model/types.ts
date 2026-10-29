/** Shapes stored as JSON. The profile is the single source of facts about the user. */

export type Experience = {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  /** "Present" for a current role. */
  end: string;
  bullets: string[];
};

export type Education = {
  id: string;
  school: string;
  degree: string;
  start: string;
  end: string;
  details: string[];
};

export type Project = { id: string; name: string; link: string; bullets: string[] };

export type Profile = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications: string[];
  languages: string[];
};

export const EMPTY_PROFILE: Profile = {
  name: "",
  headline: "",
  email: "",
  phone: "",
  location: "",
  links: [],
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
};

export type Requirement = { text: string; kind: "must" | "nice"; keywords: string[] };

export type JobPost = {
  title: string;
  company: string;
  location: string;
  salary: string;
  summary: string;
  requirements: Requirement[];
  /** Skills, tools and qualifications the post asks for, in the post's own words. */
  keywords: string[];
};

export type KeywordHit = { keyword: string; where: "shown" | "listed" | "missing"; evidence: string | null };

export type Match = {
  score: number;
  keywords: KeywordHit[];
  requirements: { text: string; kind: "must" | "nice"; status: "shown" | "listed" | "missing"; evidence: string | null }[];
};

/**
 * One proposed edit to the profile for a specific job. Edits only rephrase or reorder what's
 * already in the profile; anything that introduces a new fact is flagged and can't be accepted.
 */
export type Change =
  | { id: string; kind: "summary"; before: string; after: string; reason: string; flags: string[]; accepted: boolean }
  | { id: string; kind: "bullet"; experienceId: string; index: number; before: string; after: string; reason: string; flags: string[]; accepted: boolean }
  | { id: string; kind: "bullet-order"; experienceId: string; order: number[]; reason: string; flags: string[]; accepted: boolean }
  | { id: string; kind: "skills-order"; order: string[]; reason: string; flags: string[]; accepted: boolean };

export type TailoredCv = { changes: Change[] };

export type InterviewQuestion = { id: string; question: string; why: string; answer: string; feedback: AnswerFeedback | null };

export type AnswerFeedback = { score: number; strengths: string[]; improve: string[]; rewrite: string };

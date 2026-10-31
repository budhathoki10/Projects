import type { Profile } from "@/lib/model/types";
import { overlap, splitSentences } from "@/lib/text";
import { interviewReference, referenceForText } from "./references";
import type { CareerQuestion, QuestionKind } from "./types";

export function promptForQuestion(question: string): CareerQuestion {
  const kind: QuestionKind = /collaborat|colleague|feedback|disagree|mistake|tell me about a (?:time|problem)/i.test(question) ? "behavioural" : /current level|gap|experience with it|up to speed|haven.t used|not demonstrate|have you used/i.test(question) ? "gap" : /introduc|tell me about yourself/i.test(question) ? "introduction" : /why.*(?:company|role)|interests you/i.test(question) ? "company" : /code|python|dictionary|api|design|database|algorithm|queue|javascript|typescript|technical|test/i.test(question) ? "technical" : "behavioural";
  // A broad word such as "API" does not establish that a saved question is about validation.
  const specificConcept = /dictionary|missing.*key|keyerror|promise|concurren|unknown|type assertion|runtime validat|worker.*crash|idempoten|retr(?:y|ies)|webhook.*(?:authentic|signature)|compound index|index.*(?:query|table|field)|invalid.*(?:data|request)/i.test(question);
  const reference = kind === "technical" && specificConcept ? referenceForText(question) : undefined;
  return { id: "saved-question", kind, question, assesses: "Answer this specific question using accurate knowledge and your actual experience.", expected: reference?.checks ?? (kind === "gap" ? ["Your actual current level", "Related experience, if any", "A concrete next step"] : kind === "technical" ? ["The problem and constraints", "Your approach and one trade-off", "How you would check the result"] : ["One specific situation", "What you did yourself", "An actual result or learning"]), source: "Saved interview question", difficulty: 2, ...(reference ? { referenceId: reference.id } : {}) };
}

export function questionCoaching(question: CareerQuestion, profile: Profile) {
  const reference = interviewReference(question.referenceId);
  const collaboration = /collaborat|frontend|colleague|feedback/i.test(question.question) && question.kind === "behavioural";
  const choices = [
    ...profile.projects.map((p) => ({ label: p.name, points: p.bullets.filter((s) => !/^(Tech Stack|Technologies):/i.test(s)) })),
    ...profile.experience.map((e) => ({ label: [e.title, e.company].filter(Boolean).join(" at "), points: e.bullets })),
  ].map((item) => ({ ...item, score: question.source.includes(item.label) || (item.label && question.question.includes(item.label)) ? 2 : Math.max(0, ...item.points.map((p) => overlap(question.question, p))) })).sort((a, b) => b.score - a.score);
  const selected = choices.find((p) => p.score >= 0.12) ?? (question.kind === "introduction" ? choices[0] : undefined);
  const steps = collaboration ? ["Name one task or API endpoint you worked on together.", "Explain what you agreed with the other person and what you changed yourself.", /feedback/i.test(question.question) ? "Describe one change you made after feedback and how you checked it." : "Finish with what worked, what changed, or what you learned."] : question.expected.slice(0, 4);
  const sourceSentence = selected?.points[0] ? splitSentences(selected.points[0])[0] : "";
  const starter = question.kind === "gap" ? "My current level is [state what you actually know]. My closest relevant experience is [only if you have one]. My next step is [a specific exercise or question for the recruiter]."
    : question.kind === "introduction" ? `${profile.headline ? `My background is in ${profile.headline}. ` : "I’m currently [your actual role or course]. "}${selected ? `One relevant example is ${selected.label}. ${sourceSentence} ` : ""}[Explain your own contribution and why it connects to this role.]`
      : collaboration ? `For [one actual task], I worked with [the other person's role] to agree on [request/response fields or a shared requirement]. I personally [your actual action]. ${/feedback/i.test(question.question) ? "After their feedback, I changed [the specific change]. " : ""}[Describe the actual result or what you checked together.]`
        : ["technical", "coding", "scenario"].includes(question.kind) ? "The problem is [state the specific problem]. I would [explain the approach step by step]. I would check it using [a concrete test or piece of evidence]. A limitation is [one trade-off or failure case]."
          : selected ? `One example is ${selected.label}. ${sourceSentence}\n[Explain your personal decision and the actual result or learning.]` : "In [one real situation], my responsibility was [your actual part]. I [the action you took] because [your reason]. [Describe the actual result or learning.]";
  return { category: question.kind === "technical" || (question.kind === "project" && reference) ? "Technical" : question.kind === "gap" ? "Skills gap" : question.kind === "introduction" || question.kind === "company" ? "Motivation" : question.kind === "coding" ? "Coding" : "Behavioural", steps, source: selected?.label ?? "Your profile", evidence: selected?.points.slice(0, 2) ?? [], starter, reference };
}

import type { ApplicationAnswer, AssessedRequirement, CareerContext, LearningTask } from "./types";

export function learningResources(skill: string) {
  if (/django/i.test(skill)) return [{ title: "Django: build your first app (choose your installed version)", url: "https://docs.djangoproject.com/en/5.2/intro/tutorial01/" }];
  if (/fastapi/i.test(skill)) return [{ title: "FastAPI official tutorial", url: "https://fastapi.tiangolo.com/tutorial/" }];
  if (/python/i.test(skill)) return [{ title: "Python official tutorial (assumes basic programming knowledge)", url: "https://docs.python.org/3/tutorial/" }];
  if (/javascript|typescript|html|css|react|frontend|web/i.test(skill)) return [{ title: "MDN: learn web development", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development" }];
  return [];
}

export function gapRoadmap(requirements: AssessedRequirement[]): LearningTask[] {
  const gaps = requirements.filter((r) => r.status !== "shown").sort((a, b) => Number(b.priority === "must") - Number(a.priority === "must"));
  const seen = new Set<string>();
  return gaps.flatMap((r) => {
    const verify = r.category === "qualification" || r.category === "experience" || /\b(visa|work authori[sz]ation|citizenship|clearance|right to work)\b/i.test(r.text);
    const skill = verify ? `Verify: ${r.text}` : r.unprovenSkills[0] ?? r.skills[0] ?? r.text;
    const key = verify ? `verify:${r.id}` : skill.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    const python = /python/i.test(skill);
    const technical = /python|java|typescript|react|sql|docker|apis?\b|node|git\b|code|software|database|testing|program|backend|frontend|cloud|linux|kubernetes|mongo|debug|errors?|failures?/i.test(`${skill} ${r.text}`);
    const interpersonal = !technical && /communication|teamwork|leadership|collaborat|stakeholder|customer|writing|written|presentation|negotiat|english|language/i.test(skill);
    const skillSteps = interpersonal ? ["Choose one real situation where this skill mattered, and identify the audience and outcome.", "Prepare a short explanation or handover note; ask a peer to point out ambiguity and unanswered questions.", "Revise the explanation using that feedback, then practise a concise spoken version."] : technical ? [`Study the core concepts needed for this requirement: ${r.text}`, `Build or adapt a small work sample that demonstrates ${skill}; identify assumptions and a failure case.`, "Check the result, document the trade-off and explain what you personally implemented."] : ["Break the responsibility into observable tasks and identify what a good result looks like.", "Produce a small role-relevant work sample, such as a process walkthrough, analysis, plan or demonstration.", "Ask for feedback against the requirement and revise the work; record what you still need to learn."];
    return [{ id: `learn-${r.id}`, requirementIds: verify ? [r.id] : gaps.filter((x) => ((x.category === "skill" || x.category === "responsibility") && x.skills.includes(skill)) || x.id === r.id).map((x) => x.id), skill, priority: r.priority,
      reason: r.explanation,
      steps: verify ? ["Read the exact requirement and identify the evidence the employer accepts.", "Check your records, dates or qualification; ask the recruiter about equivalence if unclear.", "If you lack it, state the gap honestly and look for an eligible entry route."] : python ? ["Practise Python values, collections, functions, exceptions and modules.", "Read and transform a JSON or CSV file; handle missing fields and invalid input.", "Write repeatable tests, then explain one design decision and one failure you fixed."] : skillSteps,
      exercise: verify ? "Prepare a truthful evidence note or an eligibility question for the recruiter. A tutorial cannot replace a degree, licence, work authorisation or years of experience." : python ? "Build a Python application tracker that loads sample applications from CSV, validates fields, filters by stage and produces a summary." : interpersonal ? `Write a one-page explanation of a real task or project for a non-specialist colleague. Ask them to explain it back, then revise the unclear parts. Relate it to: ${r.text}` : `Produce a small practical demonstration addressing: ${r.text}`,
      acceptance: verify ? ["Record the source of the requirement.", "Record what is verified, what is missing and what needs the employer's decision."] : interpersonal ? ["Keep the original explanation and your revision.", "Record the audience's actual feedback without inventing an outcome.", "Explain what you changed and demonstrate a concise version."] : technical ? ["Keep runnable code or a shareable work sample with a README.", "Include at least one normal, one invalid-input and one boundary-case check.", "Explain a trade-off and show the result without following a tutorial step by step."] : ["Describe the task and its acceptance criteria.", "Keep the work sample and the feedback you actually received.", "Explain your decisions, observed result and remaining limitations."],
      interviewExplanation: verify ? `“My CV does not establish this requirement. [State your verified dates, qualifications or eligibility.] Could you clarify which alternatives you accept?”` : `“My current CV does not demonstrate practical evidence for ${skill}. [State your actual starting level. After completing the work, describe your real contribution, checks and limitations. Distinguish practice from professional experience.]”`,
      resources: verify ? [] : learningResources(skill), effort: verify ? "Verification step; eligibility may require a longer-term route." : "Start with 3 focused practice sessions, then reassess. Completion is not proof of job readiness.",
    } satisfies LearningTask];
  }).slice(0, 5);
}

export function basicApplicationAnswers(context: CareerContext, requirements: AssessedRequirement[]): ApplicationAnswer[] {
  const relevant = requirements.find((r) => r.status === "shown" && r.evidence.length);
  const gap = requirements.find((r) => r.priority === "must" && r.status === "missing");
  return [
    { question: "Why are you interested in this role?", answer: `I’m interested in ${context.post.title || "this role"}${context.post.company ? ` at ${context.post.company}` : ""}. ${relevant ? `My CV includes this relevant work: ${relevant.evidence[0]}` : "[Connect one real project or experience to a responsibility in the description.]"}\n[Add your personal reason for choosing this work.]`, needsInput: true },
    { question: "Why this company?", answer: "[Choose a product or responsibility from the cited company sources.]\n[Explain why it matters to you and how your actual experience connects to it.]", needsInput: true },
    { question: "How do you address a missing requirement?", answer: gap ? `My CV does not demonstrate ${gap.skills.join(", ") || gap.text}. [Describe your actual starting level.]\n[Name a concrete learning step you have genuinely started, and distinguish practice from professional experience.]` : "[Name a real development area.]\n[Explain what you are doing about it with an example you can demonstrate.]", needsInput: true },
  ];
}

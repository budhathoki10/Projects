# Application preparation

Every saved job now has an **Application plan**. The home and Progress pages link to **Application strategy**, which prioritises active interviews and submitted applications before ranking saved roles by current CV evidence coverage.

## Evidence and accuracy

The plan reads the full stored job description, retains direct source quotations and maps required/preferred skills, qualifications, experience and responsibilities to CV evidence. AI can add source-backed analysis and learning tasks; it cannot set the fit score or declare that a candidate has a missing skill. Overlapping source rows and unsupported quotations are rejected. Technology lists count as listed evidence, not demonstrated implementation. Duration and eligibility need explicit verification.

The score is an explainable heuristic, not a hiring probability or validated assessment: requirements weigh 3, preferences 1; demonstrated CV evidence earns full credit, a listed skill 45%, and missing/unresolved evidence zero. Hidden expectations are labelled inferences and excluded from the score. The original Match tab remains explicitly labelled as an initial keyword guide.

Company research needs the employer's public website. The reader fetches its homepage and up to two linked pages on the same origin, using the existing SSRF-safe fetcher. The UI shows dated quotations and source links. Navigation labels do not establish culture. The candidate must confirm that the site belongs to the employer; unavailable research remains unavailable, without an invented domain or company claims.

## CVs and applications

Tailoring and cover letters prepare a current application plan first if needed. The plan, complete job text and candidate profile inform rewriting. CV changes can now rewrite project bullets, reorder projects and reorder sections, in addition to summary, experience bullets and skills. Every proposed text change passes the existing fact checks, strengthened to detect technical skills at sentence start and in lowercase. Personal interview/letter claims cannot borrow a skill or qualification from a job description.

AI wording still requires candidate review: these checks are safeguards, not proof of semantic correctness. Measurable language must use actual source measurements. A lack of evidence in a CV is not evidence that someone has never used a skill.

Original PDF downloads remain unchanged by default. The separate **Tailored version** applies accepted changes and section order to its HTML, PDF and Word exports. No source document or original profile is overwritten by a job-specific CV.

## Learning

The roadmap focuses on five priority gaps. Coding skills get practical implementation and testing tasks; communication skills get writing, feedback and revision exercises. Qualifications, tenure and eligibility get verification steps, not promises that a short tutorial replaces them. Relevant learning links use official documentation, including the Python tutorial, FastAPI, Django and MDN. Time guidance is a starting practice schedule, not a qualification guarantee.

Work sample URLs and notes are private, self-reported progress. Marking a task complete never modifies CV skills, upgrades evidence status or increases the fit score. Candidates review actual new work in their profile and refresh affected plans. A fingerprint detects changed CV/job inputs; stale plans remain readable but cannot record new learning progress.

## Mock interviews

Interview prep includes a complete question bank for all saved skills/projects and job requirements, plus behavioural, scenario, gap, company, coding and closing questions. Actual employer questions are never claimed. A mock selects a balanced sequence of up to nine main questions; answers can produce one follow-up each, bounded to eighteen total turns.

Only the current question is answered at a time. Feedback covers correctness, depth, communication, calibrated written confidence and relevance. It includes corrections, expected concepts, a source-checked personal rewrite and an answer-specific follow-up. Difficulty changes affect the next question's wording. Code is reviewed by the model, never executed; voice/body language/confidence are not measured from text.

If AI is unavailable or invalid, the UI provides an **unscored checklist**. Correctness remains unassessed. AI and local results are distinguished in final reports; null scores are excluded from averages. First/second-half averages are descriptive practice trends with varying difficulty, not a controlled measure of improvement.

Sessions survive reloads, reject stale sources and use versioned writes to prevent double submissions. Only one active session exists per job. One interview allowance covers a complete bounded mock; concurrent start requests refund the duplicate use. Private reports and conversations can be exported and are deleted with their job/account.

## Main paths

- `src/lib/career/`: source/evidence mapping, company reader, roadmaps, question bank and feedback.
- `src/lib/services/career.ts`: private plans, learning progress and versioned mock sessions.
- `src/app/actions/career.ts`: authenticated, validated, metered actions.
- `/app/jobs/[id]/plan`: requirement map, company evidence, learning and application answers.
- `/app/jobs/[id]/interview/mock/[sessionId]`: one-question interview and final report.
- `/app/strategy`: prioritisation and recorded preparation progress.

Build/test limits: `SHORTLIST_BUILD_CACHE=0` disables persistent build caching for disposable Playwright builds, reducing duplicate disk usage without changing development caching.

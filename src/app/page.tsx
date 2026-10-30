import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ButtonLink, Eyebrow, FormMessage } from "@/components/ui";
import { TemplateThumb } from "@/components/studio/template-bits";
import { LIMITS, PASSES } from "@/lib/plans";

const SHOWCASE = [
  ["sl-084", "Saffron"],
  ["sl-011", "Meridian"],
  ["sl-061", "Masthead"],
  ["sl-033", "Charter"],
  ["sl-093", "Fjord"],
  ["sl-053", "Waypoint"],
  ["sl-072", "Blueprint"],
  ["sl-090", "Kathmandu"],
] as const;

const STEPS = [
  ["Add your CV once", "Upload a PDF or Word file, or paste it. Check what we read. From then on, it's the only source of facts about you."],
  ["Paste a job", "A link or the description. You see straight away what you already show, what's only on your skills list, and what's missing."],
  ["Tailor it", "Your most relevant work moves up, in the employer's words. You accept each change. Download a PDF or Word file."],
  ["Make it look right", "Pick from 100 templates or design your own. Each job can have its own look, and the PDF and Word file follow it."],
  ["Apply, then follow up", "Track every application. A week with no answer, we remind you, with a polite note ready to send."],
] as const;

const FAQ = [
  {
    q: "Will it make things up about me?",
    a: "No. Every suggestion is checked against your own CV. A change that adds an employer, title, number, tool, skill or qualification you didn't give us is blocked, and you'll see exactly which word was the problem.",
  },
  {
    q: "Does it apply to jobs for me?",
    a: "No. Mass auto-applying gets accounts banned on job sites and annoys recruiters. Shortlist helps you send fewer, better applications, yourself.",
  },
  {
    q: "What if a site won't let you read the job post?",
    a: "Some sites only show posts to signed-in users. Copy the description from the page and paste it in; it works the same.",
  },
  {
    q: "Is it only for tech jobs?",
    a: "No. Nursing, teaching, hospitality, sales, accounting, trades, admin, design: anything with a job post and a CV.",
  },
  {
    q: "What happens to my CV?",
    a: "It's stored in your account to do the work you ask for, never sold, and not used to train AI models. Download or delete everything from Settings at any time.",
  },
  {
    q: "I'm in Nepal. Can I pay in rupees?",
    a: `Yes. NPR ${PASSES.month.npr.toLocaleString("en-US")} for 30 days or NPR ${PASSES.quarter.npr.toLocaleString("en-US")} for 90 days, through Khalti.`,
  },
];

function Sample() {
  return (
    <div className="relative space-y-3" aria-label="Example of Shortlist matching a job post and tailoring a CV">
      <div className="rounded-md border border-border bg-surface p-5 text-sm leading-relaxed shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Job post · Customer Success Lead</p>
        <p className="mt-2">
          You&apos;ll own onboarding for new accounts, keep <mark className="marker bg-transparent text-inherit">churn</mark> low and work closely with
          sales. Experience with <mark className="marker bg-transparent text-inherit">Zendesk</mark> and{" "}
          <span className="underline decoration-dotted underline-offset-4">HubSpot</span> needed; <span className="pen-mark">Salesforce</span> is a plus.
        </p>
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
          <span className="font-mono text-2xl font-medium tabular-nums">72%</span>
          <span className="text-[13px] text-muted">Worth applying, with a tailored CV</span>
        </div>
      </div>
      <div className="ml-6 rounded-md border border-strong-border bg-surface p-4 text-sm shadow-sm">
        <p className="text-[13px] font-medium">Support Specialist, Brightdesk</p>
        <p className="mt-2 leading-relaxed">
          <del className="text-faint">Answered customer tickets </del>
          <ins className="marker no-underline">Onboarded 40 new business accounts and handled their support in Zendesk, </ins>
          keeping churn under 3%
        </p>
        <p className="mt-2 text-[13px] text-money">Using · every fact is in your CV</p>
      </div>
      <div className="ml-12 rounded-md border border-pen/40 bg-pen-soft/40 p-4 text-sm">
        <p className="leading-relaxed">…managed renewals in <strong>Salesforce</strong></p>
        <p className="mt-1 text-[13px] text-pen">Blocked · Salesforce isn&apos;t in your CV</p>
      </div>
    </div>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        {deleted === "1" && (
          <div className="mx-auto max-w-5xl px-5 pt-6">
            <FormMessage success="Your account and everything in it has been deleted." />
          </div>
        )}
        <section className="mx-auto grid max-w-5xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <Eyebrow>For anyone applying for jobs</Eyebrow>
            <h1 className="mt-4 font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">A CV for every job. Nothing made up.</h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Paste a job post. Shortlist shows how well you fit, then rewrites your CV and cover letter for that job using only what&apos;s true about
              you. It keeps track of every application and reminds you to follow up.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ButtonLink href="/signup" className="px-5 py-2.5 text-[15px]">
                Start free
              </ButtonLink>
              <span className="text-sm text-muted">{LIMITS.free.tailor} tailored CVs a month free. No card.</span>
            </div>
          </div>
          <Sample />
        </section>

        <section id="how" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <h2 className="font-serif text-4xl font-medium tracking-tight">How it works</h2>
            <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="border-t border-strong-border pt-4">
                  <p className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="templates" className="overflow-hidden border-t border-border">
          <div className="mx-auto max-w-5xl px-5 pt-20">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <h2 id="templates" className="font-serif text-4xl font-medium tracking-tight">
                  100 templates. Or make your own.
                </h2>
                <p className="mt-3 text-muted">
                  Every template says plainly whether applicant tracking systems can read it. Change fonts, colours and sections, add a photo where
                  it&apos;s expected, fit it to one page, and use a different look for every job.
                </p>
              </div>
              <ButtonLink href="/templates" variant="secondary">
                See all 100 templates
              </ButtonLink>
            </div>
          </div>
          <ul className="mx-auto mt-10 flex max-w-6xl gap-5 overflow-x-auto px-5 pb-20 [scrollbar-width:none]">
            {SHOWCASE.map(([id, name], i) => (
              <li key={id} className={`w-44 shrink-0 sm:w-52 ${i % 2 ? "mt-8" : ""}`}>
                <Link href="/templates" className="group block">
                  <div className="overflow-hidden rounded-md shadow-[0_1px_3px_rgb(0_0_0/0.08),0_12px_32px_rgb(0_0_0/0.10)] ring-1 ring-border transition group-hover:-translate-y-1">
                    <TemplateThumb id={id} name={name} />
                  </div>
                  <p className="mt-2 text-sm font-medium">{name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
            <h2 className="font-serif text-4xl font-medium tracking-tight">Why one CV doesn&apos;t work</h2>
            <div className="space-y-4 text-muted">
              <p>
                Recruiters spend seconds on a CV, and screening software looks for the words in the job post. The same CV sent to twenty jobs reads as
                written for none of them. Tailoring each one is what job seekers say is the hardest part.
              </p>
              <p>
                AI tools that &ldquo;optimise&rdquo; a CV often do it by adding skills you don&apos;t have. That gets you an interview you can&apos;t pass.
                Shortlist only rewords and reorders what you&apos;ve actually done, and shows you every change before it&apos;s used.
              </p>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-5 py-20">
            <h2 className="font-serif text-4xl font-medium tracking-tight">Pricing</h2>
            <p className="mt-3 text-muted">Pay once for your job hunt. No subscription to forget about.</p>
            <div className="mt-10 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-background text-left">
                  <tr>
                    <th className="px-4 py-4 sm:w-1/2" />
                    <th className="px-4 py-4">
                      <span className="block font-medium">Free</span>
                      <span className="font-mono text-2xl tabular-nums">$0</span>
                    </th>
                    <th className="px-4 py-4">
                      <span className="block font-medium">Job-hunt pass</span>
                      <span className="font-mono text-2xl tabular-nums">${PASSES.month.usd}</span>
                      <span className="text-muted"> / 30 days</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Tailored CVs with match check", `${LIMITS.free.tailor} a month`, "As many as you need"],
                    ["Cover letters", `${LIMITS.free.cover} a month`, "As many as you need"],
                    ["Interview practice", `${LIMITS.free.interview} sessions a month`, "As many as you need"],
                    ["All 100 CV templates, and your own", "Yes", "Yes"],
                    ["Application tracker and follow-up reminders", "Yes", "Yes"],
                    ["PDF download", "Yes", "Yes"],
                    ["Word (.docx) download", "No", "Yes"],
                  ].map(([row, free, pass]) => (
                    <tr key={row}>
                      <td className="px-4 py-3 text-muted">{row}</td>
                      <td className="px-4 py-3">{free}</td>
                      <td className="px-4 py-3">{pass}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href="/signup">Start free</ButtonLink>
              <p className="text-sm text-muted">
                Or ${PASSES.quarter.usd} for 90 days. NPR {PASSES.month.npr.toLocaleString("en-US")} / {PASSES.quarter.npr.toLocaleString("en-US")} with
                Khalti. Never renews on its own. 14-day refund.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-20">
          <h2 className="font-serif text-4xl font-medium tracking-tight">Questions</h2>
          <dl className="mt-8 divide-y divide-border border-y border-border">
            {FAQ.map((f) => (
              <div key={f.q} className="grid gap-2 py-5 md:grid-cols-[1fr_1.6fr]">
                <dt className="font-medium">{f.q}</dt>
                <dd className="text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm text-muted">
            Something else?{" "}
            <Link href="/terms" className="underline underline-offset-4">
              Read the terms
            </Link>{" "}
            or write to us.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

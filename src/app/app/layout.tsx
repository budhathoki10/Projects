import { cookies } from "next/headers";
import { logout } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell";
import { VerifyEmailBanner } from "@/components/auth-forms";
import { requireUser } from "@/lib/auth/session";
import { limitsFor, passDaysLeft } from "@/lib/plans";
import { dueFollowUpCount, listJobs } from "@/lib/services/jobs";
import { usageThisMonth } from "@/lib/services/usage";
import { VERIFY_BAR_COOKIE } from "@/lib/ui-cookies";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [followUps, jobs, usage, jar] = await Promise.all([dueFollowUpCount(user.id), listJobs(user.id), usageThisMonth(user.id), cookies()]);
  const daysLeft = passDaysLeft(user);
  const pass = daysLeft ? { daysLeft } : null;
  return (
    <AppShell
      user={{ name: user.name, email: user.email, pass, allowance: { used: usage.tailor, limit: limitsFor(user).tailor } }}
      followUps={followUps}
      jobs={jobs.map((j) => ({ id: j.id, title: j.post.title, company: j.post.company }))}
      logout={logout}
      banner={
        !user.emailVerifiedAt && !jar.has(VERIFY_BAR_COOKIE) && (
          <div className="print:hidden">
            <VerifyEmailBanner email={user.email} />
          </div>
        )
      }
    >
      {children}
    </AppShell>
  );
}

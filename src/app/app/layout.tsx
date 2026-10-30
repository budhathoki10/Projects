import { logout } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell";
import { VerifyEmailBanner } from "@/components/auth-forms";
import { requireUser } from "@/lib/auth/session";
import { hasPass, limitsFor } from "@/lib/plans";
import { dueFollowUpCount, listJobs } from "@/lib/services/jobs";
import { usageThisMonth } from "@/lib/services/usage";

const DAY = 24 * 60 * 60 * 1000;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [followUps, jobs, usage] = await Promise.all([dueFollowUpCount(user.id), listJobs(user.id), usageThisMonth(user.id)]);
  const pass = hasPass(user) && user.passUntil ? { daysLeft: Math.max(1, Math.ceil((user.passUntil.getTime() - Date.now()) / DAY)) } : null;
  return (
    <AppShell
      user={{ name: user.name, email: user.email, pass, allowance: { used: usage.tailor, limit: limitsFor(user).tailor } }}
      followUps={followUps}
      jobs={jobs.map((j) => ({ id: j.id, title: j.post.title, company: j.post.company }))}
      logout={logout}
      banner={
        !user.emailVerifiedAt && (
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

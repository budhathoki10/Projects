import { AppNav } from "@/components/app-nav";
import { KeyboardLayer } from "@/components/command-palette";
import { MobileNav } from "@/components/mobile-nav";
import { requireUser } from "@/lib/auth/session";
import { isPaid } from "@/lib/plans";
import { dueFollowUpCount, listJobs } from "@/lib/services/jobs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [followUps, jobs] = await Promise.all([dueFollowUpCount(user.id), listJobs(user.id)]);
  const paid = isPaid(user);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)] print:block">
      <aside aria-label="Navigation" className="sticky top-0 z-40 hidden h-dvh lg:block print:hidden">
        <AppNav followUps={followUps} email={user.email} paid={paid} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <MobileNav followUps={followUps} email={user.email} paid={paid} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
      <KeyboardLayer jobs={jobs.slice(0, 200).map((j) => ({ id: j.id, title: j.post.title, company: j.post.company, status: j.status }))} />
    </div>
  );
}

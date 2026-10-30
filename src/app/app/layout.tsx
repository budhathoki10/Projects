import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { VerifyEmailBanner } from "@/components/auth-forms";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { hasPass } from "@/lib/plans";
import { dueFollowUpCount } from "@/lib/services/jobs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const followUps = await dueFollowUpCount(user.id);
  return (
    <>
      <header className="border-b border-border bg-surface print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 px-5">
          <Link href="/app" aria-label="Your job hunt" className="py-3">
            <Logo />
          </Link>
          <AppNav followUps={followUps} />
          <div className="ml-auto flex items-center gap-4 py-3 text-[13px] sm:ml-0">
            {hasPass(user) ? (
              <Link href="/app/billing" className="font-medium">
                Job-hunt pass
              </Link>
            ) : (
              <Link href="/app/billing" className="text-muted hover:text-foreground">
                Free plan · <span className="text-foreground underline underline-offset-4">Get a pass</span>
              </Link>
            )}
            <span className="hidden text-muted md:inline">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="text-muted hover:text-foreground">
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      {!user.emailVerifiedAt && (
        <div className="print:hidden">
          <VerifyEmailBanner email={user.email} />
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 print:max-w-none print:p-0">{children}</main>
    </>
  );
}

import type { ReactNode } from "react";

/** The top of every app page: one plain title, an optional line under it, and actions on the right. */
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back && <div className="mb-2 text-[13px] text-muted">{back}</div>}
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A section heading inside a page: sentence case, no eyebrow, optional link on the right. */
export function SectionHeading({ id, children, action }: { id?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-[15px] font-semibold">
        {children}
      </h2>
      {action && <div className="text-[13px] text-muted">{action}</div>}
    </div>
  );
}

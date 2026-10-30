import { ATS_LABELS, type AtsLevel } from "@/lib/templates/checks";

const TONES: Record<AtsLevel, string> = {
  safe: "bg-money-soft text-money",
  mostly: "bg-background text-foreground border border-border",
  caution: "bg-pen-soft text-pen",
};

export function AtsBadge({ level }: { level: AtsLevel }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[level]}`}>{ATS_LABELS[level]}</span>;
}

/** A built-in template's pre-rendered first page (see `npm run templates:thumbs`). */
export function TemplateThumb({ id, name, className = "" }: { id: string; name: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static, pre-sized WebP thumbnails
    <img
      src={`/template-thumbs/${id}.webp`}
      alt={`${name} template`}
      loading="lazy"
      decoding="async"
      width={480}
      height={679}
      className={`aspect-[210/297] w-full bg-white object-cover object-top ${className}`}
    />
  );
}

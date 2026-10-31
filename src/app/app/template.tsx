/** Re-mounts on every navigation inside /app, so each page eases in. Plain CSS: no client code, no layout shift. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}

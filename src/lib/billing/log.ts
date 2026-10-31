import "server-only";

/**
 * One structured line per billing problem. It carries identifiers and the kind of error, never a request
 * body, header, key or card detail: logs are read by more people than the database is.
 */
export function logBilling(level: "info" | "warn" | "error", event: string, context: Record<string, string | number | boolean | null | undefined> = {}, err?: unknown) {
  const line = {
    level,
    scope: "billing",
    event,
    ...context,
    ...(err === undefined
      ? {}
      : { error: err instanceof Error ? err.name : "NonError", message: (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 200) }),
  };
  (level === "error" ? console.error : level === "warn" ? console.warn : console.info)(JSON.stringify(line));
}

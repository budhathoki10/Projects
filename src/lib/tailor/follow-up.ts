import { formatDay } from "@/lib/dates";

/** A short, polite check-in a week after applying. Plain enough to send by email or LinkedIn message. */
export function followUpMessage(input: { name: string; title: string; company: string; appliedOn: string | null }) {
  const role = input.title || "the role";
  const when = input.appliedOn ? ` on ${formatDay(input.appliedOn)}` : "";
  return {
    subject: `Following up: ${role} application`,
    body: [
      "Hello,",
      `I applied for ${role}${input.company ? ` at ${input.company}` : ""}${when} and wanted to check whether there's any update on the process.`,
      "I'm still very interested and happy to share anything else that would help.",
      `Thank you,\n${input.name}`,
    ].join("\n\n"),
  };
}

/** Compose only: the user reviews and sends from their own mailbox. */
export function emailComposeUrls({ from, to, subject, body }: { from: string; to: string; subject: string; body: string }) {
  const gmail = new URL("https://mail.google.com/mail/");
  gmail.search = new URLSearchParams({ authuser: from, view: "cm", fs: "1", to, su: subject, body }).toString();
  return {
    gmail: gmail.href,
    mailto: `mailto:${encodeURIComponent(to)}?${new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20")}`,
  };
}

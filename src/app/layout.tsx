import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cvFontVariables } from "@/components/cv/cv-fonts";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

// The Content-Security-Policy in src/proxy.ts carries a fresh nonce per request, and Next can only stamp it
// onto the scripts of a page it renders per request. A prerendered page would have none, and the browser
// would block its scripts. So every page renders on demand.
export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Shortlist. A CV for every job, without making anything up", template: "%s · Shortlist" },
  description:
    "Paste a job post. Shortlist tailors your CV and cover letter to it using only what's true about you, tracks the application, reminds you to follow up and helps you prepare for the interview.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${cvFontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans text-sm leading-normal">
        <a
          href="#main"
          className="sr-only rounded bg-ink px-3 py-2 text-on-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
        >
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

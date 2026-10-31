"use client";

import { ErrorView } from "@/components/error-view";

export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main">
      <ErrorView {...props} home="/" />
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { Button } from "./ui";

/** Opens the browser's print dialog, where "Save as PDF" is the destination. */
export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      Save as PDF
    </Button>
  );
}

"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False while the page is server-rendered HTML, true once React has taken over in the browser. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

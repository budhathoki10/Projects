"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False while rendering on the server and during hydration, true once the page is running in the browser. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

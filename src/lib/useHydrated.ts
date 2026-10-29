import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during the server render and hydration, true after. Pages are
 * prerendered at build time, so anything that depends on "now" (greetings,
 * today's date, month labels) must wait for this or React has to throw away
 * and redraw the page when the build-time text doesn't match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

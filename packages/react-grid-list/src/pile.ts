"use client";

import { type KeyboardEvent, useState } from "react";

/**
 * Which piles are open, keyed by each pile's stable id. A pile is a composite row (`selectionIds`) that
 * collapses several rows into one summary row. `initiallyOpen` is read on the first render only.
 */
export function usePileToggle(initiallyOpen: readonly string[] = []) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(initiallyOpen));
  const toggle = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { expanded, toggle };
}

/**
 * A summary row's `onKeyDown`: Enter on the row itself opens or closes its pile, so the grid's one tab
 * stop is enough to reach it. A control focused inside the row keeps its own Enter, and the grid skips
 * a key the row has handled (`preventDefault`).
 */
export const pileRowEnter = (toggle: () => void) => (event: KeyboardEvent<HTMLElement>) => {
  if (event.key !== "Enter" || event.defaultPrevented || event.target !== event.currentTarget) return;
  event.preventDefault();
  toggle();
};

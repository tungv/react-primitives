"use client";

import { useContext, useEffect, useLayoutEffect } from "react";
import {
  getFocusableElements,
  isRowAction,
  isRowVisible,
  safelyFocusElement,
  sequentialFocusTarget,
} from "./utils.js";
import {
  useGridDataDispatch,
  useGridFocusStore,
  useGridListConfig,
  useGridListDispatch,
  useGridRowsStore,
  GridListBodyContext,
  SelectionIndicatorContext,
  RowContext,
  GridContentContext,
  useSelectionState,
  useSelectionDispatch,
} from "./state.js";

export function useRegisterRow(
  rowId: string,
  readOnly?: boolean,
  disabled?: boolean,
  data?: unknown,
  selectionIds?: readonly string[],
) {
  const dispatch = useGridDataDispatch();
  const isInsideBody = useContext(GridListBodyContext);
  useEffect(() => {
    if (!isInsideBody) return;
    dispatch({ type: "addRow", rowId });
    return () => dispatch({ type: "removeRow", rowId });
  }, [dispatch, rowId, isInsideBody]);
  useEffect(() => {
    if (isInsideBody)
      dispatch({ type: "updateRow", rowId, readOnly, disabled, data, selectionIds });
  }, [dispatch, rowId, readOnly, disabled, isInsideBody, data, selectionIds]);
}

export function useHandleSpacebar(rowRef: React.RefObject<HTMLDivElement | null>) {
  const { onCheckedChange, selected } = useContext(SelectionIndicatorContext);
  const { selectionMode } = useSelectionState();
  useEffect(() => {
    const row = rowRef.current;
    if (!row || selectionMode === "none") return;
    const handle = (event: KeyboardEvent) => {
      if (event.key !== " " || event.target !== row || event.defaultPrevented) return;
      event.preventDefault();
      onCheckedChange(!selected);
    };
    row.addEventListener("keydown", handle);
    return () => row.removeEventListener("keydown", handle);
  }, [rowRef, onCheckedChange, selected, selectionMode]);
}

/** The grid's one tab stop: the row focused last, else the first visible data row. */
function tabStopRow(rows: readonly HTMLElement[], lastFocusedRowId: string | null) {
  const eligible = rows.filter((row) => row.dataset["disabled"] !== "true" && isRowVisible(row));
  return (
    eligible.find((row) => row.dataset["rowId"] === lastFocusedRowId) ??
    eligible.find((row) => row.dataset["headerRow"] !== "true") ??
    eligible[0]
  );
}

/**
 * Tab never lands on a control inside a grid row: those are reached with the arrow keys. From outside
 * every grid, a Tab the browser would land on one goes to the next place sequential navigation may
 * stop instead — that grid's tab-stop row, or past the grid if no row has registered yet. From inside
 * a grid, Tab leaves it for the next such place outside it (never another grid's row controls),
 * wrapping to the far end of the page when nothing is left, as the browser would move on from the
 * page rather than into the row. It moves focus and writes nothing, so it is as safe on rows React
 * has not hydrated as on the rest, and it works before the grid's own keydown handler has hydrated.
 */
function handleGridTab(event: KeyboardEvent) {
  if (
    event.key !== "Tab" ||
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  const from = document.activeElement;
  const grid = from?.closest("[role='grid']") ?? null;
  if (!grid) {
    const landing = sequentialFocusTarget(from, event.shiftKey);
    if (!landing || !isRowAction(landing)) return;
  }
  const accept = (element: HTMLElement) => !isRowAction(element) && !grid?.contains(element);
  const target =
    sequentialFocusTarget(grid ?? from, event.shiftKey, accept) ??
    sequentialFocusTarget(null, event.shiftKey, accept);
  if (!target) return;
  event.preventDefault();
  target.focus();
}

/** Every grid, and an app's layout, share one document listener: `handleGridTab` reads the DOM, not a grid's state. */
let tabNavigationUsers = 0;

/**
 * Installs `handleGridTab` for as long as anything that asks is mounted. Each grid asks, and so does
 * a layout that calls it: a layout hydrates before any streamed grid, so a Tab pressed
 * while a page is still arriving already skips row controls — otherwise it lands on one in a row React
 * has not hydrated, which then hydrates every pending row synchronously, one commit each.
 */
export function useGridTabNavigation() {
  useEffect(() => {
    // Capture, so focus moves before the browser goes looking for the next tabbable element.
    if (tabNavigationUsers++ === 0) document.addEventListener("keydown", handleGridTab, true);
    return () => {
      if (--tabNavigationUsers === 0) document.removeEventListener("keydown", handleGridTab, true);
    };
  }, []);
}

/**
 * One tab stop; arrow keys reach actions without hidden focus sentinel buttons.
 *
 * Nothing here writes into a row React has not hydrated. Streamed rows sit in Suspense boundaries
 * that hydrate in a later pass than this grid — and a row's own boundaries (a nested list, a
 * pile's title) later still — so on a document load most of the DOM below this hook is server HTML
 * React has yet to compare, and it reports every attribute changed there as a hydration mismatch.
 * A row's `tabindex` is therefore set only once the row has registered, which it does after
 * hydrating, and the controls inside rows are never written at all: `handleGridTab` moves focus past
 * them on Tab, whatever tab index they rendered with.
 */
export function useGridListTabIndexManager(children: React.ReactNode) {
  const { containerRef } = useContext(GridContentContext);
  const rowsStore = useGridRowsStore();
  const focusStore = useGridFocusStore();
  // Subscribed directly, not through React state: a row registering or focus moving re-renders
  // nothing, it only rewrites `tabindex` on the rows that have registered. A hydrating batch
  // registers its rows one effect at a time, so store changes are applied once, after the batch.
  useLayoutEffect(() => {
    let active = true;
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (active) apply();
      });
    };
    const apply = () => {
      const container = containerRef?.current;
      if (!container) return;
      const registered = new Set(rowsStore.getSnapshot().rows.map((row) => row.rowId));
      const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-row-id]"));
      const stop = tabStopRow(elements, focusStore.getSnapshot().lastFocusedRowId);
      for (const row of elements) {
        if (registered.has(row.dataset["rowId"] ?? "")) row.tabIndex = row === stop ? 0 : -1;
      }
    };
    apply();
    const stopRows = rowsStore.subscribe(schedule);
    const stopFocus = focusStore.subscribe(schedule);
    return () => {
      active = false;
      stopRows();
      stopFocus();
    };
  }, [children, containerRef, rowsStore, focusStore]);

  useGridTabNavigation();
}

/**
 * `useGridTabNavigation` as a component, for a layout that is a server component: render it once near
 * the root so Tab skips row controls before any streamed grid has hydrated.
 */
export function GridTabNavigation(): null {
  useGridTabNavigation();
  return null;
}

export function useRowData<T>(): T | undefined {
  return useContext(RowContext).data as T | undefined;
}

function moveToAction(row: HTMLElement, target: HTMLElement, direction: number) {
  const actions = getFocusableElements(row);
  if (!actions.length) return;
  const index = actions.indexOf(target);
  const next =
    target === row ? (direction > 0 ? actions[0] : actions.at(-1)) : actions[index + direction];
  safelyFocusElement(next ?? row);
}

export function useGridListKeyboardHandlers() {
  const { cycleRowFocus } = useGridListConfig();
  const { containerRef } = useContext(GridContentContext);
  const dispatch = useGridListDispatch();
  const selectionDispatch = useSelectionDispatch();
  const { selectionMode } = useSelectionState();
  const rowsStore = useGridRowsStore();

  return (event: React.KeyboardEvent<HTMLDivElement>) => {
    const container = containerRef?.current;
    const target = event.target as HTMLElement;
    if (!container || event.defaultPrevented || target.closest("[role='grid']") !== container)
      return;
    // Tab is `handleGridTab`'s, on the document, so it also works before this handler has hydrated.
    if (event.key === "Tab") return;
    if (target.closest("input, textarea, select, [contenteditable='true'], [role='combobox']"))
      return;
    if (
      selectionMode === "multiple" &&
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "a"
    ) {
      event.preventDefault();
      selectionDispatch({ type: "selectAllRows", allRows: rowsStore.getSnapshot().rows });
      return;
    }
    if (event.key === "Escape" && selectionMode !== "none") {
      event.preventDefault();
      selectionDispatch({ type: "clearSelection", rows: rowsStore.getSnapshot().rows });
      return;
    }
    const row = target.closest<HTMLElement>("[data-row-id]");
    if (!row) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      moveToAction(row, target, event.key === "ArrowRight" ? 1 : -1);
      return;
    }
    const rows = Array.from(
      container.querySelectorAll<HTMLElement>("[data-row-id]:not([data-disabled='true'])"),
    ).filter(isRowVisible);
    // Arrows step through every row, header included; the jumps (Home/End/Page) stay on data rows.
    const stepping = event.key === "ArrowUp" || event.key === "ArrowDown";
    const bodyRows = rows.filter((candidate) => candidate.dataset["headerRow"] !== "true");
    const scope = stepping || bodyRows.length === 0 ? rows : bodyRows;
    const index = Math.max(0, scope.indexOf(row));
    const nextIndex = rowIndexForKey(event.key, index, scope.length, cycleRowFocus);
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = scope[nextIndex];
    if (next && safelyFocusElement(next))
      dispatch({
        type: "setLastFocusedRow",
        rowId: next.dataset["rowId"] ?? null,
      });
  };
}

function rowIndexForKey(key: string, index: number, count: number, cycle: boolean) {
  switch (key) {
    case "ArrowUp":
      return cycle ? (index - 1 + count) % count : Math.max(0, index - 1);
    case "ArrowDown":
      return cycle ? (index + 1) % count : Math.min(count - 1, index + 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "PageUp":
      return Math.max(0, index - 10);
    case "PageDown":
      return Math.min(count - 1, index + 10);
    default:
      return undefined;
  }
}

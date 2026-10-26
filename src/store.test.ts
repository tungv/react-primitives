import { describe, expect, test } from "bun:test";
import { createGridStore, detachedGridStore } from "./store.js";
import { gridFocusReducer, selectedRowsAmong } from "./state.js";
import type { GridFocusState } from "./types.js";

const unfocused: GridFocusState = {
  lastFocusedRowId: null,
  lastSelectionAnchorId: null,
  isFocusWithinContainer: false,
};

describe("grid stores", () => {
  test("a store notifies only when its reducer returns a new state", () => {
    const store = createGridStore(gridFocusReducer, unfocused);
    const seen: (string | null)[] = [];
    const stop = store.subscribe(() => seen.push(store.getSnapshot().lastFocusedRowId));

    store.dispatch({ type: "setLastFocusedRow", rowId: "a" });
    store.dispatch({ type: "setLastFocusedRow", rowId: "a" });
    store.dispatch({ type: "setLastFocusedRow", rowId: "b" });
    stop();
    store.dispatch({ type: "setLastFocusedRow", rowId: "c" });

    expect(seen).toEqual(["a", "b"]);
    expect(store.getSnapshot().lastFocusedRowId).toBe("c");
  });

  test("the initial snapshot stays what the server rendered, however the state has moved", () => {
    const store = createGridStore(gridFocusReducer, unfocused);
    store.dispatch({ type: "setFocusWithinContainer", isFocusWithinContainer: true });
    store.dispatch({ type: "setLastSelectionAnchor", rowId: "a" });

    expect(store.getInitialSnapshot()).toBe(unfocused);
    expect(store.getSnapshot()).toEqual({
      lastFocusedRowId: null,
      lastSelectionAnchorId: "a",
      isFocusWithinContainer: true,
    });
  });

  test("a snapshot keeps its identity until something changes, as useSyncExternalStore requires", () => {
    const store = createGridStore(gridFocusReducer, unfocused);
    const before = store.getSnapshot();
    store.dispatch({ type: "setFocusWithinContainer", isFocusWithinContainer: false });
    expect(store.getSnapshot()).toBe(before);
  });

  test("a listener that unsubscribes while being notified does not skip the next one", () => {
    const store = createGridStore(gridFocusReducer, unfocused);
    const calls: string[] = [];
    const stopFirst = store.subscribe(() => {
      calls.push("first");
      stopFirst();
    });
    store.subscribe(() => calls.push("second"));
    store.dispatch({ type: "setLastFocusedRow", rowId: "a" });
    store.dispatch({ type: "setLastFocusedRow", rowId: "b" });
    expect(calls).toEqual(["first", "second", "second"]);
  });

  test("outside a container the store never changes", () => {
    const store = detachedGridStore<GridFocusState, Parameters<typeof gridFocusReducer>[1]>(
      unfocused,
    );
    let notified = false;
    store.subscribe(() => {
      notified = true;
    });
    store.dispatch({ type: "setLastFocusedRow", rowId: "a" });
    expect(store.getSnapshot()).toBe(unfocused);
    expect(notified).toBe(false);
  });
});

describe("selectedRowsAmong", () => {
  test("keeps selected IDs of registered rows and of composite rows' members", () => {
    const rows = [{ rowId: "a" }, { rowId: "pile:1", selectionIds: ["b", "c"] }];
    expect([...selectedRowsAmong(new Set(["a", "c", "gone"]), rows)]).toEqual(["a", "c"]);
  });
});

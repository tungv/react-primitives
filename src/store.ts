/**
 * A reducer's state held outside React, for grid state that must never be a context value.
 *
 * A grid's rows usually stream in, each in its own Suspense boundary, and React cannot deliver a
 * context change into a boundary it has not hydrated without hydrating it first. When that change
 * renders on a sync lane — a focus or hover event, or an update batched with one, since React renders
 * Sync, InputContinuous and Default lanes together — it hydrates every pending boundary below the
 * provider synchronously, one boundary per commit. Each commit runs that row's registration effect,
 * so after fifty of them React logs "Maximum update depth exceeded", and the page is frozen for
 * as long as the chain takes. It does not matter whether anything inside the boundary reads the
 * context: React cannot look inside, so every dehydrated boundary under a changed provider is hit.
 *
 * So state that changes while rows are still hydrating — which rows have registered, where focus is,
 * which title labels the grid — lives in a store like this one. The context holds the store, whose
 * identity never changes; readers subscribe with `useSyncExternalStore` for the part they need, or
 * read `getSnapshot()` when an event handler runs, and a change re-renders only those readers.
 */
export type GridStore<State, Action> = {
  getSnapshot: () => State;
  /** What the server rendered with, so a component hydrating after the state moved matches its HTML. */
  getInitialSnapshot: () => State;
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: Action) => void;
};

export function createGridStore<State, Action>(
  reducer: (state: State, action: Action) => State,
  initialState: State,
): GridStore<State, Action> {
  let state = initialState;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    getInitialSnapshot: () => initialState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

/** A store that never changes, read by grid parts rendered outside any container. */
export function detachedGridStore<State, Action>(state: State): GridStore<State, Action> {
  return {
    getSnapshot: () => state,
    getInitialSnapshot: () => state,
    subscribe: () => () => {},
    dispatch: () => {},
  };
}

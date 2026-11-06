"use client";

// Drafts scoped to their mounted provider, so nested editors never overwrite each other's.

import { useCallback, type PropsWithChildren, type SetStateAction } from "react";
import { createReducerContext } from "./reducer-context.js";

export type DraftAction<State> = {
  [Key in keyof State]: { type: "update"; field: Key; value: SetStateAction<State[Key]> };
}[keyof State];

type DraftContextAction<State> = DraftAction<State> | { type: "reset"; value: State };

/** Functional updates are evaluated against the latest draft, including batched updates. */
export function draftReducer<State>(state: State, action: DraftAction<State>): State {
  const previous = state[action.field];
  const next =
    typeof action.value === "function"
      ? (action.value as (value: typeof previous) => typeof previous)(previous)
      : action.value;
  return Object.is(previous, next) ? state : { ...state, [action.field]: next };
}

/** One reducer per editor, with separate read/write contexts, scoped to its mounted provider. */
export function createDraftContext<State>(displayName: string) {
  const [Provider, useContextState, useDispatch] = createReducerContext(
    (state: { draft: State | null }, action: DraftContextAction<State>) => {
      if (state.draft === null) throw new Error(`${displayName} requires a provider`);
      if (action.type === "reset")
        return Object.is(state.draft, action.value) ? state : { draft: action.value };
      const draft = draftReducer(state.draft, action);
      return draft === state.draft ? state : { draft };
    },
    { draft: null as State | null },
    displayName,
  );

  function DraftProvider({ initial, children }: PropsWithChildren<{ initial: State }>) {
    return <Provider draft={initial}>{children}</Provider>;
  }

  function useDraft() {
    const { draft } = useContextState();
    const dispatch = useDispatch();
    const update = useCallback(
      <Key extends keyof State>(field: Key, value: SetStateAction<State[Key]>) => {
        dispatch({ type: "update", field, value } as DraftAction<State>);
      },
      [dispatch],
    );
    const reset = useCallback((value: State) => dispatch({ type: "reset", value }), [dispatch]);
    if (draft === null) throw new Error(`${displayName} requires a provider`);
    return [draft, update, reset] as const;
  }

  return [DraftProvider, useDraft] as const;
}

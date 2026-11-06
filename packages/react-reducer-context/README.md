# @tungv/react-reducer-context

One reducer behind two React contexts, state and dispatch, so a component that only dispatches never re-renders
when the state changes. Part of [tungv/react-primitives](https://github.com/tungv/react-primitives).

```sh
npm install @tungv/react-reducer-context
```

```tsx
import { createReducerContext } from "@tungv/react-reducer-context";

const [CounterProvider, useCounter, useCounterDispatch] = createReducerContext(
  (state: { count: number }, by: number) => ({ count: state.count + by }),
  { count: 0 },
  "Counter",
);

<CounterProvider count={5}>…</CounterProvider>; // props are laid over the initial state, once, on mount
```

The provider also takes `middleware(dispatch, getNextState)`, which wraps dispatch: it can compute the state an
action would produce, and decide whether to dispatch at all (a controlled component reporting a value instead of
storing it, for example).

## Drafts

`createDraftContext<State>(name)` returns `[DraftProvider, useDraft]` for editors whose fields affect each other.
Each provider holds its own draft, so nested or side-by-side editors never overwrite one another.

```tsx
const [ProjectDraft, useProjectDraft] = createDraftContext<{ name: string; tags: string[] }>("Project editor");

<ProjectDraft initial={{ name: project.name, tags: project.tags }}>…</ProjectDraft>;

const [draft, update, reset] = useProjectDraft();
update("tags", (tags) => [...tags, "Design"]); // functional updates see the latest draft, even when batched
```

`initial` seeds the draft once; re-rendering with new data does not erase unsaved edits. To start over for a
different record, key the provider. `useDraft` outside its provider throws, naming the editor.

## Licence

MIT

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createDraftContext, draftReducer, type DraftAction } from "./index.js";

type Draft = { name: string; tags: string[]; budgets: Record<string, string> };
const initial: Draft = { name: "Apollo", tags: ["Review, QA"], budgets: { "2026-01": "40" } };

describe("form draft reducer", () => {
  test("preserves sibling fields and immutable previous drafts", () => {
    const next = draftReducer(initial, { type: "update", field: "name", value: "Zephyr" });
    expect(next).toEqual({ name: "Zephyr", tags: ["Review, QA"], budgets: { "2026-01": "40" } });
    expect(initial.name).toBe("Apollo");
    expect(next.tags).toBe(initial.tags);
    expect(draftReducer(next, { type: "update", field: "name", value: "Zephyr" })).toBe(next);
  });
  test("batched functional updates read the latest field and keep unrelated months", () => {
    const actions: DraftAction<Draft>[] = [
      { type: "update", field: "tags", value: (tags) => [...tags, "Development"] },
      {
        type: "update",
        field: "tags",
        value: (tags) => tags.filter((tag) => tag !== "Review, QA"),
      },
      { type: "update", field: "budgets", value: (budgets) => ({ ...budgets, "2026-02": "0" }) },
    ];
    expect(actions.reduce(draftReducer<Draft>, initial)).toEqual({
      name: "Apollo",
      tags: ["Development"],
      budgets: { "2026-01": "40", "2026-02": "0" },
    });
    expect(initial.tags).toEqual(["Review, QA"]);
  });
  test("providers isolate simultaneous and nested editor drafts", () => {
    const [Provider, useDraft] = createDraftContext<Draft>("Test editor");
    function Read() {
      return <span>{useDraft()[0].name}</span>;
    }
    const html = renderToStaticMarkup(
      <>
        <Provider initial={initial}>
          <Read />
          <Provider initial={{ ...initial, name: "Nested" }}>
            <Read />
          </Provider>
          <Read />
        </Provider>
        <Provider initial={{ ...initial, name: "Other" }}>
          <Read />
        </Provider>
      </>,
    );
    expect(html).toBe(
      "<span>Apollo</span><span>Nested</span><span>Apollo</span><span>Other</span>",
    );
    expect(() => renderToStaticMarkup(<Read />)).toThrow("Test editor requires a provider");
  });
});

describe("createReducerContext", () => {
  test("lays provider props over the initial state, and middleware sees the next state", async () => {
    const { createReducerContext } = await import("./index.js");
    const [Provider, useCount, useDispatch] = createReducerContext(
      (state: { count: number; label: string }, by: number) => ({ ...state, count: state.count + by }),
      { count: 0, label: "Count" },
    );
    function Show() {
      const { count, label } = useCount();
      useDispatch();
      return <span>{`${label}: ${count}`}</span>;
    }
    expect(renderToStaticMarkup(<Show />)).toBe("<span>Count: 0</span>");
    expect(
      renderToStaticMarkup(
        <Provider count={5}>
          <Show />
        </Provider>,
      ),
    ).toBe("<span>Count: 5</span>");
  });
});

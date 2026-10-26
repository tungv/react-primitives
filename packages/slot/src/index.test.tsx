import { describe, expect, test } from "bun:test";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Slot, cn, mergeRefs, mergeSlotProps } from "./index.js";

describe("mergeSlotProps", () => {
  test("runs both handlers, the slot's first, and joins classes and styles", () => {
    const calls: string[] = [];
    const merged = mergeSlotProps(
      { onClick: () => calls.push("slot"), className: "row", style: { color: "red", margin: 0 }, role: "row" },
      { onClick: () => calls.push("child"), className: "mine", style: { color: "blue" }, role: "link" },
    );
    (merged["onClick"] as () => void)();
    expect(calls).toEqual(["slot", "child"]);
    expect(merged["className"]).toBe("row mine");
    expect(merged["style"]).toEqual({ color: "blue", margin: 0 });
    // Anything else is the child's when both set it.
    expect(merged["role"]).toBe("link");
  });

  test("keeps a handler only one side has", () => {
    const onFocus = () => {};
    expect(mergeSlotProps({ onFocus }, {})["onFocus"]).toBe(onFocus);
    expect(mergeSlotProps({}, { onFocus })["onFocus"]).toBe(onFocus);
  });
});

describe("Slot", () => {
  test("renders its one child with the slot's props laid under the child's own", () => {
    const html = renderToStaticMarkup(
      <Slot role="row" className="row" data-slot="grid-list-row">
        <section className="mine">Content</section>
      </Slot>,
    );
    expect(html).toBe('<section class="row mine" role="row" data-slot="grid-list-row">Content</section>');
  });

  test("takes exactly one element child, as asChild promises", () => {
    expect(() => renderToStaticMarkup(<Slot>text</Slot>)).toThrow(/single React element/);
  });
});

test("mergeRefs sets every ref it is given", () => {
  const object = createRef<string>();
  let seen: string | null = null;
  const merged = mergeRefs<string>(object, (value) => {
    seen = value;
  });
  if (typeof merged === "function") merged("node");
  expect(object.current).toBe("node");
  expect(seen === "node").toBe(true);
});

test("cn joins the names that are set", () => {
  expect(cn("a", false, null, undefined, "b")).toBe("a b");
  expect(cn(false, "")).toBeUndefined();
});

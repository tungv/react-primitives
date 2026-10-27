// Keyboard, pointer and form behaviour in a DOM (happy-dom). The server-rendering tests run in the same
// process without browser globals, so this file registers the DOM for its own tests only.
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { useState } from "react";

type Testing = typeof import("@testing-library/react");
type UserEvent = (typeof import("@testing-library/user-event"))["userEvent"];
type Parts = typeof import("./index.js");

let testing: Testing;
let userEvent: UserEvent;
let parts: Parts;

beforeAll(async () => {
  GlobalRegistrator.register();
  // React's act() warnings ask for this flag. Testing Library would set it and register its cleanup with
  // hooks of its own, which cannot be added from inside this one, so this file does both itself.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  process.env["RTL_SKIP_AUTO_CLEANUP"] = "true";
  testing = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).userEvent;
  parts = await import("./index.js");
});

afterEach(() => testing.cleanup());

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const PEOPLE = [
  { id: "ada", name: "Ada" },
  { id: "bo", name: "Bo" },
  { id: "cy", name: "Cy" },
];

function People({
  selectionMode = "none",
  onValueChange,
  disabled = [],
}: {
  selectionMode?: "none" | "multiple";
  onValueChange?: (value: string[]) => void;
  disabled?: string[];
}) {
  const { GridListContainer, GridListContent, GridBody, GridListRow, GridListCell, GridListItemIndicatorRoot } = parts;
  const selection =
    selectionMode === "multiple"
      ? ({ selectionMode: "multiple", ...(onValueChange ? { onValueChange } : {}) } as const)
      : ({ selectionMode: "none" } as const);
  return (
    <>
      <button type="button">Before</button>
      <GridListContainer aria-label="People" name="people" {...selection}>
        <GridListContent>
          <GridBody>
            {PEOPLE.map((person) => (
              <GridListRow key={person.id} rowId={person.id} disabled={disabled.includes(person.id)}>
                {selectionMode === "multiple" ? (
                  <GridListCell>
                    <GridListItemIndicatorRoot selectLabel={`Select ${person.name}`} deselectLabel={`Deselect ${person.name}`} />
                  </GridListCell>
                ) : null}
                <GridListCell>{person.name}</GridListCell>
                <GridListCell>
                  <button type="button">Edit {person.name}</button>
                  <button type="button">Remove {person.name}</button>
                </GridListCell>
              </GridListRow>
            ))}
          </GridBody>
        </GridListContent>
      </GridListContainer>
      <button type="button">After</button>
    </>
  );
}

/** Rows register in effects and the tab stop is applied in a microtask after them. */
const settle = () => testing.act(async () => {
  await Promise.resolve();
});

const rowNamed = (view: ReturnType<Testing["render"]>, name: string) =>
  view.getAllByRole("row").find((row) => row.textContent?.includes(name)) ?? null;

describe("keyboard", () => {
  test("the grid is one tab stop, and Tab never lands on a control inside a row", async () => {
    const user = userEvent.setup();
    const view = testing.render(<People />);
    await settle();

    await user.click(view.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(rowNamed(view, "Ada"));
    await user.tab();
    expect(document.activeElement).toBe(view.getByRole("button", { name: "After" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(rowNamed(view, "Ada"));
  });

  test("Up and Down move between rows, Home and End jump, and the grid remembers the last row", async () => {
    const user = userEvent.setup();
    const view = testing.render(<People />);
    await settle();

    await user.click(view.getByRole("button", { name: "Before" }));
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowNamed(view, "Bo"));
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(rowNamed(view, "Cy"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowNamed(view, "Cy"));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(rowNamed(view, "Ada"));
    await user.keyboard("{ArrowDown}");

    // Leaving and coming back returns to the row focused last.
    await user.tab();
    await user.tab({ shift: true });
    await settle();
    expect(document.activeElement).toBe(rowNamed(view, "Bo"));
  });

  test("Left and Right move between a row and its controls, and Up and Down from a control move rows", async () => {
    const user = userEvent.setup();
    const view = testing.render(<People />);
    await settle();

    await user.click(view.getByRole("button", { name: "Before" }));
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Edit Ada" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Remove Ada" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(rowNamed(view, "Ada"));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(view.getByRole("button", { name: "Remove Ada" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowNamed(view, "Bo"));
  });

  test("disabled rows are skipped", async () => {
    const user = userEvent.setup();
    const view = testing.render(<People disabled={["bo"]} />);
    await settle();

    await user.click(view.getByRole("button", { name: "Before" }));
    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rowNamed(view, "Cy"));
  });
});

describe("selection", () => {
  test("Space toggles the focused row, Ctrl+A selects every row and Escape clears", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    const view = testing.render(<People selectionMode="multiple" onValueChange={(value) => changes.push(value)} />);
    await settle();

    await user.click(view.getByRole("button", { name: "Before" }));
    await user.tab();
    await user.keyboard(" ");
    expect(rowNamed(view, "Ada")?.getAttribute("aria-selected")).toBe("true");
    expect(view.getByRole("checkbox", { name: "Deselect Ada" }).getAttribute("aria-checked")).toBe("true");

    await user.keyboard("{Control>}a{/Control}");
    expect(view.getAllByRole("row").map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "true"]);

    await user.keyboard("{Escape}");
    expect(view.getAllByRole("row").map((row) => row.getAttribute("aria-selected"))).toEqual(["false", "false", "false"]);
    expect(changes).toEqual([["ada"], ["ada", "bo", "cy"], []]);
  });

  test("Shift-clicking a checkbox selects the range from the last one clicked", async () => {
    const user = userEvent.setup();
    const view = testing.render(<People selectionMode="multiple" />);
    await settle();

    await user.click(view.getByRole("checkbox", { name: "Select Ada" }));
    await user.keyboard("{Shift>}");
    await user.click(view.getByRole("checkbox", { name: "Select Cy" }));
    await user.keyboard("{/Shift}");
    expect(view.getAllByRole("row").map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true", "true"]);
  });

  test("a controlled grid shows the value it is given and reports the next one", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [value, setValue] = useState<string[]>(["bo"]);
      const { GridListContainer, GridListContent, GridBody, GridListRow, GridListCell, GridListItemIndicatorRoot } = parts;
      return (
        <>
          <output>{value.join(",")}</output>
          <GridListContainer aria-label="People" selectionMode="multiple" value={value} onValueChange={setValue}>
            <GridListContent>
              <GridBody>
                {PEOPLE.map((person) => (
                  <GridListRow key={person.id} rowId={person.id}>
                    <GridListCell>
                      <GridListItemIndicatorRoot selectLabel={`Select ${person.name}`} deselectLabel={`Deselect ${person.name}`} />
                    </GridListCell>
                    <GridListCell>{person.name}</GridListCell>
                  </GridListRow>
                ))}
              </GridBody>
            </GridListContent>
          </GridListContainer>
        </>
      );
    }
    const view = testing.render(<Controlled />);
    await settle();

    expect(rowNamed(view, "Bo")?.getAttribute("aria-selected")).toBe("true");
    await user.click(view.getByRole("checkbox", { name: "Select Cy" }));
    expect(view.getByRole("status").textContent).toBe("bo,cy");
    await user.click(view.getByRole("checkbox", { name: "Deselect Bo" }));
    expect(view.getByRole("status").textContent).toBe("cy");
  });
});

describe("forms", () => {
  test("a named grid submits its selected rows and the focused row", async () => {
    const user = userEvent.setup();
    const view = testing.render(
      <form aria-label="Pick">
        <People selectionMode="multiple" />
      </form>,
    );
    await settle();

    await user.click(view.getByRole("checkbox", { name: "Select Ada" }));
    await user.click(view.getByRole("checkbox", { name: "Select Cy" }));
    await user.keyboard("{ArrowDown}");
    const form = view.getByRole("form", { name: "Pick" }) as HTMLFormElement;
    // happy-dom's FormData keeps only the first option of a multiple select, so the select is read as the
    // form control a browser submits.
    const people = form.elements.namedItem("people") as HTMLSelectElement;
    expect(Array.from(people.selectedOptions, (option) => option.value)).toEqual(["ada", "cy"]);
    expect(new FormData(form).get("people.focused")).toBe("cy");
  });
});

describe("hover highlight", () => {
  test("pointing at a row anchors the one highlight to it, and leaving the grid hides it", async () => {
    const user = userEvent.setup();
    const view = testing.render(<People />);
    await settle();

    const highlight = view.container.querySelector<HTMLElement>("[data-slot='grid-list-highlight']");
    const bo = rowNamed(view, "Bo");
    expect(highlight?.hasAttribute("data-visible")).toBe(false);
    await user.hover(view.getByText("Bo"));
    expect(highlight?.hasAttribute("data-visible")).toBe(true);
    expect(highlight?.style.getPropertyValue("position-anchor")).toBe(bo?.style.getPropertyValue("anchor-name"));
    await user.unhover(view.getByRole("grid"));
    expect(highlight?.hasAttribute("data-visible")).toBe(false);
  });
});

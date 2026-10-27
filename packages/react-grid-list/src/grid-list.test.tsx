import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GridBody,
  GridHeader,
  GridListCell,
  GridListColumnHeader,
  GridListRowHeader,
  GridListContainer,
  GridListContent,
  GridListRow,
} from "./components.js";
import { selectableRowIds, selectionIdsInRange, selectionReducer } from "./state.js";
import type { SelectionState } from "./types.js";

describe("grid list server rendering", () => {
  test("forwards container labeling to the semantic grid without browser globals", () => {
    const html = renderToStaticMarkup(
      <GridListContainer aria-label="Projects" aria-describedby="help">
        <GridListContent>
          <GridBody>
            <GridListRow rowId="project-1" readOnly>
              <GridListCell>Gallery</GridListCell>
              <GridListCell>
                <button type="button">Open</button>
              </GridListCell>
            </GridListRow>
          </GridBody>
        </GridListContent>
      </GridListContainer>,
    );
    expect(html).toMatch(/role="grid"[^>]*aria-label="Projects"[^>]*aria-describedby="help"/);
    expect(html).toContain('role="rowgroup"');
    expect(html).toContain('aria-readonly="true"');
    expect(html.match(/role="gridcell"/g)).toHaveLength(2);
    expect(html).not.toContain("aria-selected");
    expect(html).not.toContain("data-focus-scope-sentinel");
  });

  test("gives every data row, and no header row, a place for the shared hover highlight", () => {
    const html = renderToStaticMarkup(
      <GridListContainer selectionMode="multiple" aria-label="Entries">
        <GridListContent>
          <GridHeader>
            <GridListRow rowId="__select-all__">
              <GridListCell>Select all</GridListCell>
            </GridListRow>
          </GridHeader>
          <GridBody>
            <GridListRow rowId="entry-1">
              <GridListCell>One</GridListCell>
            </GridListRow>
            <GridListRow rowId="entry-2" asChild>
              <section>
                <GridListCell>Two</GridListCell>
              </section>
            </GridListRow>
          </GridBody>
        </GridListContent>
      </GridListContainer>,
    );
    // One highlight inside the grid, out of the accessibility tree and unanchored until something is hovered.
    expect(html).toMatch(/role="grid"[^>]*>\s*<div[^>]*aria-hidden="true"/);
    expect(html).not.toContain("position-anchor");
    const anchors = [...html.matchAll(/style="[^"]*anchor-name:(--[^;"]+)/g)].map(([, name]) => name);
    expect(anchors).toHaveLength(2);
    expect(new Set(anchors).size).toBe(2);
    expect(html).toMatch(/<section[^>]*anchor-name/);
  });

  test("supports asChild and announces multiple selection", () => {
    const html = renderToStaticMarkup(
      <GridListContainer selectionMode="multiple" aria-label="People">
        <GridListContent>
          <GridBody>
            <GridListRow rowId="person-1" asChild disabled>
              <section>
                <GridListCell>Person</GridListCell>
              </section>
            </GridListRow>
          </GridBody>
        </GridListContent>
      </GridListContainer>,
    );
    expect(html).toContain('aria-multiselectable="true"');
    expect(html).toMatch(/<section[^>]*role="row"/);
    expect(html).toContain('aria-disabled="true"');
  });

  test("a row renders its selection without waiting for rows to register", () => {
    // Rows never read the registry, which changes as each one hydrates, so a selected row is
    // selected in the server HTML rather than only after it has registered on the client.
    const html = renderToStaticMarkup(
      <GridListContainer selectionMode="multiple" initialValue={["person-1"]} aria-label="People">
        <GridListContent>
          <GridBody>
            <GridListRow rowId="person-1">
              <GridListCell>One</GridListCell>
            </GridListRow>
            <GridListRow rowId="person-2">
              <GridListCell>Two</GridListCell>
            </GridListRow>
          </GridBody>
        </GridListContent>
      </GridListContainer>,
    );
    const rows = html.match(/<div[^>]*role="row"[^>]*>/g) ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('aria-selected="true"');
    expect(rows[0]).toContain('data-selected="true"');
    expect(rows[1]).toContain('aria-selected="false"');
  });
});

describe("grid list selection", () => {
  test("single selection replaces the previous full row ID", () => {
    const state: SelectionState = {
      selectionMode: "single",
      selectedRows: new Set(["project-alpha"]),
    };
    const next = selectionReducer(state, { type: "selectRow", rowId: "project-beta" });
    expect([...next.selectedRows]).toEqual(["project-beta"]);
    expect([...state.selectedRows]).toEqual(["project-alpha"]);
  });

  test("select all excludes disabled and read-only rows and preserves locked selections", () => {
    const state: SelectionState = { selectionMode: "multiple", selectedRows: new Set(["locked"]) };
    const rows = [
      { rowId: "editable" },
      { rowId: "disabled", disabled: true },
      { rowId: "locked", readOnly: true },
      { rowId: "unselected-locked", readOnly: true },
    ];
    const selected = selectionReducer(state, { type: "selectAllRows", allRows: rows });
    expect([...selected.selectedRows]).toEqual(["editable", "locked"]);
    expect([...selectionReducer(selected, { type: "clearSelection", rows }).selectedRows]).toEqual([
      "locked",
    ]);
  });

  test("select all takes the members of a collapsed pile, but not a member registered as read-only", () => {
    const state: SelectionState = { selectionMode: "multiple", selectedRows: new Set() };
    const rows = [
      { rowId: "entry" },
      // A collapsed pile: its members have not mounted, so only the pile names them.
      { rowId: "pile:a", readOnly: true, selectionIds: ["a-1", "a-2"] },
      // An open pile whose members have registered, one of them locked.
      { rowId: "pile:b", readOnly: true, selectionIds: ["b-1", "b-2"] },
      { rowId: "b-1" },
      { rowId: "b-2", readOnly: true },
    ];
    expect(selectableRowIds(rows)).toEqual(["entry", "a-1", "a-2", "b-1"]);
    const selected = selectionReducer(state, { type: "selectAllRows", allRows: rows });
    expect([...selected.selectedRows]).toEqual(["entry", "a-1", "a-2", "b-1"]);
  });

  test("range selection expands composite rows in either direction", () => {
    const rows = [
      // Registration can follow streamed resolution rather than visual order.
      { rowId: "after" },
      { rowId: "disabled", disabled: true },
      { rowId: "stack", readOnly: true, selectionIds: ["stack-a", "stack-b"] },
      { rowId: "before" },
      { rowId: "locked", readOnly: true },
    ];
    const visualOrder = ["before", "stack", "disabled", "locked", "after"];

    expect(selectionIdsInRange(rows, "before", "after", visualOrder)).toEqual([
      "before",
      "stack-a",
      "stack-b",
      "after",
    ]);
    expect(selectionIdsInRange(rows, "after", "stack", visualOrder)).toEqual([
      "stack-a",
      "stack-b",
      "after",
    ]);
  });
});

describe("grid list slots", () => {
  test("every part carries a stable data-slot, and a caller's class is the part's only class", () => {
    const html = renderToStaticMarkup(
      <GridListContainer aria-label="Queue">
        <GridListContent gridClassName="queue" scrollable>
          <GridHeader>
            <GridListRow rowId="header">
              <GridListColumnHeader sortable onSort={() => {}}>
                Name
              </GridListColumnHeader>
            </GridListRow>
          </GridHeader>
          <GridBody>
            <GridListRow rowId="f-1" className="queue__row">
              <GridListRowHeader>#1 Mia</GridListRowHeader>
              <GridListCell>Room 2</GridListCell>
            </GridListRow>
          </GridBody>
        </GridListContent>
      </GridListContainer>,
    );
    expect(html).toContain('data-slot="grid-list-container"');
    expect(html).toMatch(/data-slot="grid-list-scroll" data-scrollable=""/);
    // The grid and its body rows are also the hover-highlight group and its targets; the grid's slot names win.
    expect(html).toMatch(/data-slot="grid-list" class="queue" role="grid"[^>]*data-hover-highlight-group=""/);
    expect(html).toMatch(/data-slot="grid-list-highlight" data-hover-highlight-fill="" aria-hidden="true"/);
    expect(html).toContain('data-slot="grid-list-rowgroup"');
    expect(html).toMatch(
      /data-hover-highlight-target="" data-slot="grid-list-row" role="row"[^>]*class="queue__row"[^>]*style="anchor-name:--hover-highlight-/,
    );
    expect(html).toMatch(/data-slot="grid-list-columnheader"[^>]*data-sortable="true"/);
    expect(html).toContain('data-slot="grid-list-rowheader"');
    expect(html).toContain('data-slot="grid-list-cell"');
    expect(html).not.toContain('data-slot="hover-highlight');
    // Only the body row is a target; the header row is a control above them.
    expect(html.match(/data-hover-highlight-target/g)).toHaveLength(1);
  });
});

# @tungv/grid-list

Accessible React grid lists: rows a person moves through and acts on, with aligned columns. The grid is one
tab stop. Arrow keys move between rows and between a row's controls. Rows can be selected, and a named grid
submits with a form. One hover highlight glides between rows. It stays correct when rows stream in through
Suspense and hydrate one at a time.

React 19 and modern browsers. No runtime dependencies besides React.

```sh
npm install @tungv/grid-list
```

```css
/* After your reset or `@import "tailwindcss";`, so the grid's rules sit above the base layer. */
@import "@tungv/grid-list/styles.css";
```

```tsx
import { GridBody, GridListCell, GridListContainer, GridListContent, GridListRow } from "@tungv/grid-list";

<GridListContainer aria-labelledby="queue-heading">
  <GridListContent gridClassName="grid-cols-[minmax(0,1fr)_auto] gap-x-3">
    <GridBody>
      {fittings.map((f) => (
        <GridListRow key={f.id} rowId={f.id}>
          <GridListCell>
            <a href={`/fittings/${f.id}`}>{f.name}</a>
          </GridListCell>
          <GridListCell>
            <button type="button">Remove</button>
          </GridListCell>
        </GridListRow>
      ))}
    </GridBody>
  </GridListContent>
</GridListContainer>;
```

The parts are client components (`"use client"`). A server component can render them and pass server-rendered
rows as children without moving its data fetching to the client.

## Rules for rendering lists

- Define columns and gaps on `GridListContent` with `gridClassName` (any class, e.g. Tailwind's `grid-cols-[...]`
  and `gap-x-3`). Row groups and rows take them through CSS subgrid, so every row's cells line up. Place a cell
  with `grid-column`/`grid-row` when a narrow screen stacks it on its own line.
- Give each row a stable `rowId` (the record's id), and wrap its content in cells or row headers.
- Label the grid with `GridListTitle`, `aria-label`, or `aria-labelledby` pointing at the section's heading.
  Container labels are forwarded to the grid. `GridListCaption` adds a description. A title or caption goes
  inside `GridListContainer` and outside `GridListContent`.
- Keep flexible text columns at `minmax(0, 1fr)` with `min-width: 0` cells, so a long name wraps instead of
  widening the grid on a phone.
- Tests address a grid by role and name (`grid "Queue"`) and its rows as `row`; reach a row's controls inside
  it, never by position.
- A row must not paint an opaque background at rest, or the hover highlight disappears behind it.

## Styling

`styles.css` holds the layout (subgrid rows, the clipping grid, the scroll wrapper), the focus ring, the
selected tint, the default checkbox, and the hover highlight's geometry and motion. Its rules are in the
`components` cascade layer and wrapped in `:where()`. A class or Tailwind utility you put on a part therefore
always wins, whichever order the two are declared in. The only rules outside the layer are the ones that blank a
row's own hover fill while the highlight paints, and the ones that hide the highlight where it cannot be drawn.

Each part carries a stable `data-slot`, for styling it from an ancestor (in Tailwind,
`[&_[data-slot=grid-list]]:overflow-visible`):

| Slot | Part |
| --- | --- |
| `grid-list-container` | `GridListContainer` |
| `grid-list-scroll` | the wrapper `GridListContent` renders, with `data-scrollable` when `scrollable` |
| `grid-list` | the grid (`role="grid"`) |
| `grid-list-highlight` | the grid's hover highlight |
| `grid-list-rowgroup` | `GridHeader`, `GridBody`, `GridFooter` |
| `grid-list-row` | `GridListRow` |
| `grid-list-columnheader` / `grid-list-rowheader` / `grid-list-cell` | headers and cells |
| `grid-list-title` / `grid-list-caption` | title and caption |
| `grid-list-check` | `GridListItemIndicatorRoot` |

Rows also carry `data-row-id`, `data-selected`, `data-disabled`, `data-readonly` and `data-header-row`.

Custom properties, set on the grid or any ancestor:

| Property | Default | |
| --- | --- | --- |
| `--gl-accent` | `currentColor` | selected tint (10%), hover fill (7%), checked box |
| `--gl-radius` | `0` | hover fill's corners |
| `--gl-ring` | `#1a56db` | a focused row's ring |
| `--hover-highlight-duration` | `220ms` | travel time |
| `--hover-highlight-ease` | a back-out curve that overshoots about 4% | travel curve |
| `--hover-highlight-inset` | `0px` | shrinks the fill inside its row |
| `--hover-highlight-z` | `-1` | the fill's stacking within the grid |
| `--hover-highlight-rest-scale` | `0.96` | how small the fill starts when it appears |

The grid clips (`overflow: clip`) so the highlight's overshoot cannot grow a scrollbar in the `overflow-x: auto`
wrapper. That scrollbar would move the row under the pointer mid-click. A grid whose rows open something that
floats outside the row (a row menu) sets `overflow: visible` on the wrapper and the grid instead, and gives the
highlight a curve that never overshoots (`--hover-highlight-ease: cubic-bezier(0.22, 1, 0.36, 1)`). A row whose
control has opened a popover (`aria-expanded="true"`) is lifted over the rows after it.

## Hover highlight

Every grid is a hover-highlight group, and the rows in `GridBody` are its targets. Instead of each row lighting
its own background, one fill glides between them. It is positioned by CSS anchor positioning: React only passes
an anchor name, and the browser keeps the fill on its row through scrolling and reflow without measuring
anything. While the highlight can paint, a row's own `:hover` background is blanked. Header rows are not
targets. A row whose surface is part of what it is (a tinted card) passes `data-hover-highlight="under"` to keep
its fill, translucent over the highlight. The highlight ignores touch, and it is not drawn without anchor
positioning, in forced colours or in print, where rows keep their own hover styling.

The highlight is exported on its own for other lists (navigation, menus):

```tsx
import { HoverHighlight, HoverHighlightGroup, HoverHighlightTarget } from "@tungv/grid-list";

<HoverHighlightGroup render={<nav aria-label="Main" />}>
  <HoverHighlight className="rounded-md bg-neutral-100" />
  {links.map((link) => (
    <HoverHighlightTarget key={link.href} render={<a href={link.href} />}>
      {link.label}
    </HoverHighlightTarget>
  ))}
</HoverHighlightGroup>;
```

`render` takes an element to render as, with the part's props merged under its own (handlers chained, classes
joined, refs both set). A component that renders its own element can spread `useHoverHighlightTarget()` onto it
instead. The hook returns nothing outside a group.

## Selection and forms

Selection defaults to `none`. Opt into `single` or `multiple` with `initialValue`, or control it with `value`
and `onValueChange`. `GridListItemIndicatorRoot` renders a checkbox button (`selectLabel` and `deselectLabel`
name it) or wraps your own `GridListItemSelectedIndicator`, `GridListItemUnselectedIndicator` and
`GridListItemIndeterminateIndicator`. In a `GridHeader` row it becomes "select all". Shift-clicking a checkbox
selects the range from the last one clicked, in rendered order.

Disabled rows are skipped by the keyboard and never selected. Read-only rows keep whatever selection they have.

A grid with `name` submits its selected row IDs under that name, and the focused row as `<name>.focused`.
`required` makes an empty selection invalid; `onInvalid` handles it. `GridCurrentFocusFormField`,
`GridCurrentSelectedRowsFormField` and `CurrentRowIdFormField` place the same values explicitly.

`rowData` attaches application data to a row; `useSelectedRowsData()`, `useFocusedRowData()` and `useRowData()`
read it back.

### Composite rows

A row can stand for several data rows, such as a collapsed pile. Pass their IDs as `selectionIds`: selecting
the row, select-all and Shift-click ranges then include every ID it represents. Mark it `readOnly` when its own
`rowId` should not be submitted. Rows kept mounted while hidden are left out of keyboard traversal.

```tsx
<GridListRow rowId="pile:2026-10-26" selectionIds={pile.map((entry) => entry.id)} readOnly>
  <GridListCell>
    <GridListItemIndicatorRoot selectLabel="Select the day's entries" />
  </GridListCell>
  <GridListRowHeader>26 October</GridListRowHeader>
  <GridListCell>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
      Show entries
    </button>
  </GridListCell>
</GridListRow>
```

### Headers and sorting

`GridHeader`, `GridFooter`, `GridListColumnHeader` and `GridListRowHeader` give the grid header rows and
headers. A sortable column header takes `sortable`, `sortDirection` and an `onSort` callback; sorting the rows is
yours.

## Keyboard

| Key | |
| --- | --- |
| `Tab` / `Shift+Tab` | Into and out of the grid. Controls inside rows are never tab stops |
| `Up` / `Down` | Previous or next row, from the row or any of its controls |
| `Left` / `Right` | Between the row and its controls |
| `Home` / `End` | First or last row |
| `PageUp` / `PageDown` | Ten rows |
| `Space` | Toggles the focused row's selection |
| `Ctrl/Cmd+A` | Selects every eligible row (multiple selection) |
| `Escape` | Clears selection, keeping read-only rows' |

Tab leaves the grid for the next focusable element outside it, wrapping to the far end of the page. On a page
where nothing outside the grid can take focus, there is nowhere to send it, and the browser's own Tab moves
into the row's controls.

Native text editing keys inside inputs, selects, text areas and comboboxes are left alone. `cycleRowFocus` wraps
Up and Down at the ends. A row's own `onKeyDown` that calls `preventDefault()` keeps the grid from handling
that key.

## Streaming and hydration

The grid keeps one tab stop without writing into HTML that React has not hydrated yet. Streamed rows hydrate
after the grid, and a row's own Suspense boundaries hydrate later still. React reports any attribute changed
there first as a hydration mismatch. So a row's `tabindex` is set only once the row registers, after it
hydrates. The controls inside rows are never written at all. A single document-level Tab handler moves focus
to the grid's tab stop on the way in and past the grid on the way out, so the controls keep the tab index they
rendered with. If a page streams grids, render `<GridTabNavigation />` once in its layout. Tab then skips row
controls before any grid has hydrated.

Nothing above the rows may change a context value while rows are still hydrating. React can deliver a context
change into a Suspense boundary that has not hydrated only by hydrating the boundary first. It cannot tell
whether anything inside reads that context, so every pending boundary under the changed provider is hit. On a
sync lane it hydrates them synchronously, one boundary per commit. Sync lanes include a focus or hover event,
and anything React batches with one. Each commit runs that row's registration effect, and after fifty React
gives up with "Maximum update depth exceeded". So the state that changes during hydration lives in per-grid
stores rather than context values. That state is the row registry, focus, the selection anchor, and the
title/caption labels. The context carries only the stores, whose identity never changes, and components
subscribe with `useSyncExternalStore` to the part they need. A row reads the registry only when an event runs.
It takes its own selected state from the held selection, never from the registry. The hover highlight writes its
anchor straight onto the element and re-renders nothing. Selection itself is still a context, because it changes
only when someone selects.

## Origin

Started in [tungv/demo-gallery-app](https://github.com/tungv/demo-gallery-app) and hardened in production apps:
stores for streamed hydration, composite rows, a document-level Tab handler in place of focus sentinels, and the
anchor-positioned hover highlight.

## Development

```sh
bun install
bun run check   # typecheck, tests (server rendering and happy-dom interaction), build, dist check
```

## Licence

MIT

# @tungv/hover-highlight

One hover highlight that glides between the items of a list, instead of each item lighting its own background.
It is positioned by CSS anchor positioning: React passes only an anchor name, and the browser keeps the fill
on its item through scrolling, reflow and animated layout without measuring anything. Hovering re-renders
nothing, so it is safe in lists whose items still stream in through Suspense.

React 19 and modern browsers. Part of [tungv/primitives](https://github.com/tungv/primitives); it builds on
[`@tungv/slot`](https://github.com/tungv/primitives/tree/main/packages/slot), and
[`@tungv/grid-list`](https://github.com/tungv/primitives/tree/main/packages/grid-list) uses it for every grid.

```sh
npm install @tungv/hover-highlight
```

```css
/* After your reset or `@import "tailwindcss";`. */
@import "@tungv/hover-highlight/styles.css";
```

```tsx
import { HoverHighlight, HoverHighlightGroup, HoverHighlightTarget } from "@tungv/hover-highlight";

<HoverHighlightGroup render={<nav aria-label="Main" />}>
  <HoverHighlight className="rounded-md bg-neutral-100" />
  {links.map((link) => (
    <HoverHighlightTarget key={link.href} render={<Link href={link.href} />}>
      {link.label}
    </HoverHighlightTarget>
  ))}
</HoverHighlightGroup>;
```

## Parts

| Part | |
| --- | --- |
| `HoverHighlightGroup` | The scope the highlight moves within, and what it is positioned against. Isolates its stacking, so the fill's `z-index: -1` stays visible over a surface that paints its own background. |
| `HoverHighlight` | The moving fill. Give it classes for how it looks; its size and place come from the target under it. Hidden from assistive technology. |
| `HoverHighlightTarget` | Makes an element a target. Keeps the element's own `data-slot`. |
| `useHoverHighlightTarget()` | The same as props to spread onto an element you render yourself: an anchor name and pointer and focus handlers. Merge them so the handlers chain rather than replace yours. Outside a group it returns nothing, so a component that only sometimes sits in a group can call it unconditionally. |

Each part takes `render`, an element to render as, with the part's props merged under its own: handlers chained,
classes joined, styles merged, refs both set. Without it the part is a `div`.

## Behaviour

- **Hover and keyboard:** the highlight follows the pointer, and `:focus-visible` focus; a click does not park
  it. Whichever moved last wins. It fades out when nothing is hovered or focused.
- **Touch:** touch is not hover, so a tap never moves it. On a touch screen targets keep their own pressed
  styling.
- **Own fills:** while the highlight can paint, a target's own `:hover` and `:focus-visible` background is set
  to transparent (beating `hover:bg-*` utilities), so the pointer never drags one fill while the item it left
  keeps another. `[data-active]` and `:active` are left alone. A target whose surface is part of what it is
  passes `data-hover-highlight="under"` to keep its fill, translucent over the highlight. A target must not
  paint an opaque background at rest, or the highlight disappears behind it.
- **Fallbacks:** without anchor positioning, in forced colours and in print the highlight is not drawn, and
  targets keep their own hover styling.
- **Nesting:** a group inside another keeps its targets to itself (`anchor-scope` where supported; the names
  are unique per group anyway).

## Motion

The travel overshoots about 4% on a back-out curve and the resize never does, so the fill snaps rather than
wobbles. Appearing is a small pop, and fading in waits until the move is nearly over, so returning to a group
shows the fill on the item entered instead of flying across the list. Reduced motion keeps only the fade.

Tune it with custom properties on the group, the highlight or any ancestor:

| Property | Default | |
| --- | --- | --- |
| `--hover-highlight-duration` | `220ms` | travel time |
| `--hover-highlight-ease` | `cubic-bezier(0.16, 1.36, 0.36, 1)` | travel curve; `cubic-bezier(0.22, 1, 0.36, 1)` never overshoots |
| `--hover-highlight-inset` | `0px` | shrinks the fill inside its target |
| `--hover-highlight-z` | `-1` | the fill's stacking within the group |
| `--hover-highlight-rest-scale` | `0.96` | how small the fill starts when it appears |

A full-width item whose fill overshoots can grow a scrollbar in an `overflow: auto` ancestor. Clip the group
(`overflow: clip`), or use the curve that never overshoots.

## Styling hooks

The parts carry `data-slot="hover-highlight-group"`, `data-slot="hover-highlight"` and
`data-hover-highlight-target`, and the highlight has `data-visible` while it shows. The stylesheet's own rules
sit in the `components` cascade layer inside `:where()`, so any class you add wins.

## Licence

MIT

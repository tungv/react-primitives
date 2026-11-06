# @tungv/react-reserve-layout

Swap content without layout shift. Every child of a `ReserveLayout` sits in the same grid cell, so the
alternatives that are hidden still reserve their size, and the container is always as large as the largest one:
a button that changes "Save" to "Saving…" keeps its width. Part of [tungv/react-primitives](https://github.com/tungv/react-primitives).

```sh
npm install @tungv/react-reserve-layout
```

```css
@import "@tungv/react-reserve-layout/styles.css"; /* after your reset or Tailwind */
```

```tsx
import { Hidden, ReserveLayout, Visible } from "@tungv/react-reserve-layout";

<button type="submit">
  <ReserveLayout>
    {pending ? <Hidden>Save</Hidden> : <Visible>Save</Visible>}
    {pending ? <Visible>Saving…</Visible> : <Hidden>Saving…</Hidden>}
  </ReserveLayout>
</button>;
```

| Part | |
| --- | --- |
| `ReserveLayout` | A `div` with one grid cell for all its children. `placeItems`: `center` (default), `start`, `end`, `stretch` or `baseline`. |
| `Hidden` | Keeps its size while out of sight, focus order (`tabindex=-1`) and the accessibility tree (`aria-hidden`). Outside a `ReserveLayout` it renders nothing. |
| `Visible` | Shows its children. Outside a `ReserveLayout` it is just its children. |

The parts carry `data-slot="reserve-layout"`, `reserve-layout-hidden` and `reserve-layout-visible`. The
stylesheet's rules sit in the `components` cascade layer inside `:where()`, so a class you add wins. The
stylesheet is required: without it the alternatives sit side by side and nothing is hidden.

## Licence

MIT

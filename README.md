# tungv/react-primitives

Accessible React primitives for lists and forms people move through and act on, each published on its own:

| Package | | Depends on |
| --- | --- | --- |
| [`@tungv/react-grid-list`](packages/react-grid-list) | Grid lists: one tab stop, arrow-key rows and actions, selection, form fields, composite rows. Safe for streamed, partially hydrated rows. | react-slot, react-hover-highlight, react-reducer-context |
| [`@tungv/react-hover-highlight`](packages/react-hover-highlight) | One hover fill that glides between a list's items, positioned by CSS anchor positioning. | react-slot |
| [`@tungv/react-form`](packages/react-form) | Form primitives on native constraint validation: fields, labels, controls, messages, auto-submit, masked input. | react-slot, react-reducer-context, react-reserve-layout |
| [`@tungv/react-interactive-form`](packages/react-interactive-form) | A form whose action runs in a transition: field and form errors, pending state, focus restore, redirect and refresh. | react-slot, react-reducer-context, react-reserve-layout, `next` (peer) |
| [`@tungv/react-navigation-form`](packages/react-navigation-form) | GET forms for search and filters that navigate with the Next.js router. | react-slot, react-reserve-layout, `next` (peer) |
| [`@tungv/react-reserve-layout`](packages/react-reserve-layout) | Swap content (a button's "Save" and "Saving…") without layout shift. | none |
| [`@tungv/react-reducer-context`](packages/react-reducer-context) | One reducer behind separate state and dispatch contexts, and scoped editor drafts. | none |
| [`@tungv/react-slot`](packages/react-slot) | `asChild`/`render` prop merging and ref composition. | none |

Install the one you use; its dependencies come with it. React 19 is a peer dependency of each. The packages
with styles ship one stylesheet each (`@tungv/<name>/styles.css`). The rules sit in the `components` cascade
layer inside `:where()`, so they work with or without Tailwind, and your own classes always win.

They started in [tungv/demo-gallery-app](https://github.com/tungv/demo-gallery-app) and were hardened in
production apps before being split out here.

## Development

Bun workspaces. Each package builds with `tsc` to ESM plus declarations, one file per module, so `"use client"`
directives survive for React Server Components.

```sh
bun install
bun run check     # build, typecheck, tests (server rendering and happy-dom interaction), dist check
bun run release   # check, then `bun publish` each package whose version is not on npm, dependencies first
```

`scripts/check-dist.ts` checks each built package: client modules start with `"use client"`, every export
resolves, packing replaces `workspace:` ranges with versions, and Node can import it.

To release, bump the changed packages' versions (and the ranges of packages that need the new version), then
run `bun run release`. Publish with `bun publish`, which the script uses, never `npm publish`: npm leaves the
`workspace:` ranges in place.

## Licence

MIT

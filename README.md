# tungv/react-primitives

Accessible React primitives for lists and forms people move through and act on, each published on its own:

| Package | | Depends on |
| --- | --- | --- |
| [`@tungv/react-grid-list`](packages/react-grid-list) | Grid lists: one tab stop, arrow-key rows and actions, selection, form fields, composite rows. Safe for streamed, partially hydrated rows. | react-slot, react-hover-highlight, react-reducer-context |
| [`@tungv/react-hover-highlight`](packages/react-hover-highlight) | One hover fill that glides between a list's items, positioned by CSS anchor positioning. | react-slot |
| [`@tungv/react-form`](packages/react-form) | Form primitives on native constraint validation: fields, labels, controls, messages, auto-submit, masked input. | react-slot, react-reducer-context, react-reserve-layout |
| [`@tungv/next-interactive-form`](packages/next-interactive-form) | A form whose action runs in a transition: field and form errors, pending state, focus restore, redirect and refresh. | react-slot, react-reducer-context, react-reserve-layout, `next` (peer) |
| [`@tungv/next-navigation-form`](packages/next-navigation-form) | GET forms for search and filters that navigate with the Next.js router. | react-slot, react-reserve-layout, `next` (peer) |
| [`@tungv/react-reserve-layout`](packages/react-reserve-layout) | Swap content (a button's "Save" and "Saving…") without layout shift. | none |
| [`@tungv/react-reducer-context`](packages/react-reducer-context) | One reducer behind separate state and dispatch contexts, and scoped editor drafts. | none |
| [`@tungv/react-slot`](packages/react-slot) | `asChild`/`render` prop merging and ref composition. | none |

`react-` packages need only React; `next-` packages also need the Next.js App Router. Install the one you use; its dependencies come with it. React 19 is a peer dependency of each. The packages
with styles ship one stylesheet each (`@tungv/<name>/styles.css`). The rules sit in the `components` cascade
layer inside `:where()`, so they work with or without Tailwind, and your own classes always win.

They started in [tungv/demo-gallery-app](https://github.com/tungv/demo-gallery-app) and were hardened in
production apps before being split out here.

## Development

Bun workspaces. Each package builds with `tsc` to ESM plus declarations, one file per module, so `"use client"`
directives survive for React Server Components. Packages depend on each other with ordinary version ranges
(`^0.1.0`), which Bun links to the local copies; Changesets keeps them current on release.

```sh
bun install
bun run check       # build, typecheck, tests (server rendering and happy-dom interaction), dist check
bun run changeset   # describe a change to one or more packages, for the next release
```

`scripts/check-dist.ts` checks each built package: client modules start with `"use client"`, every export
resolves, the packed manifest has no `workspace:` ranges, and Node can import it (except the `next-` packages,
which only Next's bundler resolves).

## Releasing

Releases run in GitHub Actions (`.github/workflows/release.yml`), with [Changesets](https://changesets.dev):

1. A pull request that changes a package adds a changeset (`bun run changeset`): the packages, the bump, and a
   line for the changelog.
2. When it merges, the workflow opens or updates the **Release packages** pull request, which bumps versions,
   updates the ranges of the packages that depend on them, and writes each package's `CHANGELOG.md`.
3. Merging that pull request publishes every package whose version is not on npm yet, in dependency order, with
   provenance, and tags and releases each on GitHub.

Publishing tries npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) first: the workflow proves
its identity to npm with OIDC, and needs no token. It falls back to the `NPM_TOKEN` repository secret, a granular
npm access token. npm only lets a package that already exists name a trusted publisher, so the token publishes the
first versions. After that:

```sh
npm login
bun run release:trust   # make release.yml each package's trusted publisher (npm 11.15+, asks for 2FA)
```

Then delete the `NPM_TOKEN` secret and revoke the token, and set each package's publishing access on npmjs.com to
"Require two-factor authentication and disallow tokens". Granular tokens expire after at most 90 days, and npm is
retiring 2FA-bypass tokens for publishing, so trusted publishing is the path that keeps working.

To publish without CI instead, `bun run release:first` publishes every package not yet on npm from your machine.

## Licence

MIT

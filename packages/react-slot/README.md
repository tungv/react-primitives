# @tungv/react-slot

`asChild` and `render`-prop composition for React, with no other dependencies. A component renders the one child
element it is given, with its own props merged under the child's:

- handlers both run, the component's first;
- class names are joined, the component's first;
- styles are merged, the child's winning;
- refs are both set;
- any other prop is the child's when both set it.

Part of [tungv/react-primitives](https://github.com/tungv/react-primitives). It has no `"use client"` directive and holds no
state, so server components can render it too.

```sh
npm install @tungv/react-slot
```

```tsx
import { Slot } from "@tungv/react-slot";

function Row({ asChild, ...props }: { asChild?: boolean } & React.ComponentProps<"div">) {
  const rowProps = { role: "row", className: "row", ...props };
  return asChild ? <Slot {...rowProps} /> : <div {...rowProps} />;
}

<Row asChild>
  <section className="mine">…</section>
</Row>;
// <section class="row mine" role="row">…</section>
```

| Export | |
| --- | --- |
| `Slot` | Renders its one element child with its props merged in. Throws on anything but a single element, like `Children.only`. |
| `mergeSlotProps(ours, theirs)` | The merge on its own, for a `render` prop or `cloneElement` of your own. |
| `mergeRefs(...refs)` | One callback ref that sets every ref given, object or function. |
| `cn(...names)` | Joins the class names that are set; `undefined` when none are. |

## Licence

MIT

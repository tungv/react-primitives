# @tungv/next-navigation-form

GET forms for search and filters that navigate with the Next.js App Router, in a transition, while keeping a
native `method="get"` form underneath. Part of [tungv/react-primitives](https://github.com/tungv/react-primitives).

```sh
npm install @tungv/next-navigation-form
```

```css
@import "@tungv/next-navigation-form/styles.css"; /* after your reset or Tailwind; for the messages */
```

```tsx
import { NavigationButton, NavigationForm } from "@tungv/next-navigation-form";

<NavigationForm action="/people" preventReset>
  <input name="q" defaultValue={q} />
  <label>
    <input type="checkbox" name="role" value="admin" /> Admin
  </label>
  <button type="submit">Search</button>
  <NavigationButton searchParams={new URLSearchParams({ role: "admin" })}>Admins only</NavigationButton>
</NavigationForm>;
```

Submitting goes to `action` with every named field in the query, repeated names included, and files left out.

| Part | |
| --- | --- |
| `NavigationForm` | The form. With `preventReset` it handles the submit itself, so the fields keep what was typed; without it, it runs as a React form `action`, which resets them after navigating. Carries `data-loading="true"` while navigating, and the class `group` for `group-data-[loading=true]:` styles. `asChild` renders its one child instead. |
| `NavigationButton` | Goes to `formAction` (or the form's `action`) with its own `searchParams`, not the form's fields: a chip or preset that knows its destination. |
| `NavigationSubmitMessage` / `NavigationLoadingMessage` | Shown while idle / navigating. Use them inside a `ReserveLayout`. |

`next` (15 or later) is a peer dependency. Import the package from client components; like `next/navigation`,
it is meant for Next's bundler rather than plain Node.

## Licence

MIT

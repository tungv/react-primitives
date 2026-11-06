# @tungv/next-interactive-form

A form that runs its action in a React transition, for Next.js App Router apps: the fields stay as typed while it
runs, its errors show beside the fields they belong to, and the result can redirect, refresh the route or replace
the form. Part of [tungv/react-primitives](https://github.com/tungv/react-primitives).

```sh
npm install @tungv/next-interactive-form
```

```css
@import "@tungv/next-interactive-form/styles.css"; /* after your reset or Tailwind */
```

```tsx
import {
  FormErrorMessage,
  InteractiveForm,
  LoadingMessage,
  SubmitButton,
  SubmitMessage,
} from "@tungv/next-interactive-form";
import { ReserveLayout } from "@tungv/react-reserve-layout";

<InteractiveForm fields={["email"]} action={saveProfile /* a Server Action, or any async function */}>
  <input name="email" />
  <FormErrorMessage name="email" match="taken">That email is taken</FormErrorMessage>
  <FormErrorMessage>Please fix the errors above</FormErrorMessage>
  <SubmitButton>
    <ReserveLayout>
      <SubmitMessage>Save</SubmitMessage>
      <LoadingMessage>Saving…</LoadingMessage>
    </ReserveLayout>
  </SubmitButton>
</InteractiveForm>;
```

## The action and its result

`action(formData)` receives the form's fields (typed by `fields`, if given) and returns:

| Result | |
| --- | --- |
| `errors` | Messages per field name, and `$` for the form. Shown by `FormErrorMessage`; changing a field clears its own. |
| `result` | Any value. `useFormResult()` reads it, and `Success` shows its children once there is one. |
| `redirect` | Navigates there with the Next.js router instead of showing anything. |
| `refresh` | Refreshes the current route, then shows the result. |
| `nextElement` | Replaces the form with this element. |

While the action runs the form is `inert`, `useFormPending()` is true, and submit and action buttons carry
`data-pending` (they pulse; with reduced motion they dim). Focus returns to where it was when the action is done.
Resetting the form clears errors and results.

## Parts

| Part | |
| --- | --- |
| `InteractiveForm` | The form. `asChild` renders its one child instead. |
| `SubmitButton` | A submit button, inert while pending. |
| `SubmitMessage` / `LoadingMessage` | Shown while idle / pending. Put both in a `ReserveLayout` so the button keeps its size. |
| `FormErrorMessage` | With `name`: shown while that field has errors (or, with `match`, that exact error). Without: shown while there are any errors. |
| `Success`, `useFormResult()` | The result, once there is one. |
| `FormBoundary` | Shares one form's state with things rendered outside it, such as `ActionButton` and `Success`. |
| `ActionButton` | A button inside a `FormBoundary`, anywhere, that runs its own `formAction` on the form's fields, then resets the form. |
| `PrintResult` | Prints the form's state, for debugging. |

The parts carry `data-slot`: `interactive-form`, `submit-button`, `action-button` and `form-error-message`
(in `--form-error-color`, default `#dc2626`). The stylesheet's rules sit in the `components` cascade layer inside
`:where()`, so any class you add wins.

`next` (15 or later) is a peer dependency: redirect and refresh use its App Router. Import the package from
client components; like `next/navigation`, it is meant for Next's bundler rather than plain Node.

## Licence

MIT

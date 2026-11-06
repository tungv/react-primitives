# @tungv/react-form

Accessible form primitives on native constraint validation: `required`, `type="email"`, `pattern`,
`min`/`max` and `setCustomValidity` decide what is valid, and these components decide when and where to say so.
Part of [tungv/react-primitives](https://github.com/tungv/react-primitives).

```sh
npm install @tungv/react-form
```

```css
@import "@tungv/react-form/styles.css"; /* after your reset or Tailwind; brings reserve-layout's stylesheet */
```

```tsx
import { Form, FormField, FormLabel, FormMessage, FormSubmit, InputControl } from "@tungv/react-form";

<Form action={save}>
  <FormField name="email">
    <FormLabel>Email</FormLabel>
    <InputControl type="email" required />
    <FormMessage match="valueMissing">Enter your email</FormMessage>
    <FormMessage match="typeMismatch">That is not an email address</FormMessage>
  </FormField>
  <FormSubmit>Save</FormSubmit>
</Form>;
```

## How validation shows

- A field's messages stay hidden while the person types. Leaving the control, or submitting the form, checks it
  and shows the `FormMessage` whose `match` names the failed constraint (a `ValidityState` key, or the exact
  message passed to `setCustomValidity`). `match="valid"` shows once the control is valid.
- The browser's own validation bubbles are suppressed; the messages take their place. Submitting an invalid form
  focuses its first invalid, visible control.
- The control is described by the message that shows (`aria-describedby`) and marked `aria-invalid`. Controls
  and the form carry `data-valid`/`data-invalid`, plus `data-user-valid`/`data-user-invalid` once the person
  has interacted, for styling.
- Resetting the form clears every message. Your own `onSubmit`, `onReset`, `onInvalid`, `onChange` and
  `onBlur` run as well as the form's.

## Parts

| Part | |
| --- | --- |
| `Form` | A `form`, or its one child with `asChild`. |
| `FormField` | Groups one control, its label and its messages under a `name` (required), which becomes the control's `name`. |
| `FormLabel` | A `label` for the field's control. Double-clicking it focuses the control instead of selecting its text. |
| `InputControl` | An `input`, or its one child with `asChild` (a `textarea`, `select` or custom control), given the field's id and name. |
| `FormMessage` | One message, shown while `match` holds. Wrap a field's messages in a `ReserveLayout` to keep their space reserved. |
| `FormSubmit` | A submit button, or its one child with `asChild`. |
| `FormSubmitMessage` / `FormPendingMessage` | Shown while a form `action` function is idle / pending (React's `useFormStatus`). Use them inside a `ReserveLayout`. |
| `FormControlItem` | A sub-field for one of several controls under one name, such as a radio group's options. `defaultItem` makes it the one the label points at. |
| `AutoSubmitForm` / `AutoSubmitField` | Submits the form when the wrapped control fires `triggerPropName` (`"onChange"`, `"onValueChange"` …), after `debounceMs` if given. |
| `MaskedInput` | Shows a formatted value while submitting the parsed one under `name`, keeping the caret in place. `parse` returns `valid(value, source)` or `invalid(source)`; an invalid value submits nothing and sets the custom error `BAD_FORMAT_ERROR`. |

## Styling

The parts carry `data-slot`: `form`, `form-field`, `form-label`, `form-control`, `form-message` (with
`data-invalid` for a failed constraint), `form-submit` and `form-control-item`. The stylesheet carries the reference
design: a one-column grid form with 1rem gaps, padding and a 28rem maximum width; bold small labels; small
messages in `--form-error-color` (default `#dc2626`). Its rules sit in the `components` cascade layer inside
`:where()`, so any class you add wins.

## Licence

MIT

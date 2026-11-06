// Runs in the shared happy-dom (scripts/happy-dom.ts); see the root `test` script.
import { afterEach, beforeAll, describe, expect, test } from "bun:test";

type Testing = typeof import("@testing-library/react");
type UserEvent = (typeof import("@testing-library/user-event"))["userEvent"];
type Parts = typeof import("./index.js");

let testing: Testing;
let userEvent: UserEvent;
let parts: Parts;

beforeAll(async () => {
  testing = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).userEvent;
  parts = await import("./index.js");
});

afterEach(() => testing.cleanup());

describe("validation", () => {
  function Profile({
    onReset,
    onChange,
  }: {
    onReset?: () => void;
    onChange?: () => void;
  }) {
    const { Form, FormField, FormLabel, InputControl, FormMessage, FormSubmit } = parts;
    return (
      <Form aria-label="Profile" onSubmit={(event) => event.preventDefault()} {...(onReset ? { onReset } : {})}>
        <FormField name="email">
          <FormLabel>Email</FormLabel>
          <InputControl type="email" required {...(onChange ? { onChange } : {})} />
          <FormMessage match="valueMissing">Enter your email</FormMessage>
          <FormMessage match="typeMismatch">That is not an email</FormMessage>
        </FormField>
        <FormSubmit>Save</FormSubmit>
        <button type="reset">Reset</button>
      </Form>
    );
  }

  test("leaving a control shows the message for the constraint it fails, and describes the control with it", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Profile />);
    const email = view.getByLabelText("Email");

    await user.click(email);
    await user.tab();
    const message = view.getByText("Enter your email");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe(message.id);
    expect(view.queryByText("That is not an email")).toBeNull();

    await user.type(email, "not-an-email");
    // Typing hides the message until the control is left again.
    expect(view.queryByText("Enter your email")).toBeNull();
    await user.tab();
    expect(view.getByText("That is not an email")).toBeDefined();
  });

  test("submitting marks every field as interacted and shows the failed constraints", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Profile />);

    await user.click(view.getByRole("button", { name: "Save" }));
    expect(view.getByText("Enter your email")).toBeDefined();
    const form = view.getByRole("form", { name: "Profile" });
    expect(form.hasAttribute("data-invalid")).toBe(true);
    expect(form.hasAttribute("data-user-invalid")).toBe(true);
  });

  test("reset clears the messages, and the caller's own handlers still run", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const view = testing.render(<Profile onReset={() => calls.push("reset")} onChange={() => calls.push("change")} />);

    await user.click(view.getByRole("button", { name: "Save" }));
    expect(view.getByText("Enter your email")).toBeDefined();
    await user.click(view.getByRole("button", { name: "Reset" }));
    expect(view.queryByText("Enter your email")).toBeNull();
    expect(view.getByRole("form", { name: "Profile" }).hasAttribute("data-invalid")).toBe(false);

    await user.type(view.getByLabelText("Email"), "a");
    expect(calls).toEqual(["reset", "change"]);
  });
});

describe("AutoSubmitField", () => {
  test("submits its form when the control fires the named prop", async () => {
    const user = userEvent.setup();
    const submitted: string[] = [];
    const { AutoSubmitForm, AutoSubmitField } = parts;
    const view = testing.render(
      <AutoSubmitForm
        aria-label="Filters"
        onSubmit={(event) => {
          event.preventDefault();
          submitted.push(String(new FormData(event.currentTarget).get("status")));
        }}
      >
        <AutoSubmitField triggerPropName="onChange">
          <select name="status" aria-label="Status" defaultValue="open">
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </AutoSubmitField>
      </AutoSubmitForm>,
    );

    await user.selectOptions(view.getByLabelText("Status"), "closed");
    expect(submitted).toEqual(["closed"]);
  });
});

describe("MaskedInput", () => {
  const parse = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    return digits.length <= 4 ? parts.valid(digits, raw) : parts.invalid<string>(raw);
  };
  const format = (masked: ReturnType<typeof parse>) =>
    masked.format((value) => (value.length > 2 ? `${value.slice(0, 2)}:${value.slice(2)}` : value));

  test("shows the formatted value and submits the parsed one under its name", async () => {
    const user = userEvent.setup();
    const { MaskedInput } = parts;
    const view = testing.render(
      <form aria-label="Time">
        <MaskedInput aria-label="Start" name="start" parse={parse} format={format} />
      </form>,
    );

    await user.type(view.getByLabelText("Start"), "0930");
    expect((view.getByLabelText("Start") as HTMLInputElement).value).toBe("09:30");
    const form = view.getByRole("form", { name: "Time" }) as HTMLFormElement;
    expect(new FormData(form).get("start")).toBe("0930");
  });

  test("an input it cannot parse keeps what was typed, submits nothing and reports a bad format", async () => {
    const user = userEvent.setup();
    const { MaskedInput, BAD_FORMAT_ERROR } = parts;
    const view = testing.render(
      <form aria-label="Time">
        <MaskedInput aria-label="Start" name="start" parse={parse} format={format} />
      </form>,
    );

    await user.type(view.getByLabelText("Start"), "093015");
    const input = view.getByLabelText("Start") as HTMLInputElement;
    // Typed after "09:30" was formatted, so the colon stays in what was typed.
    expect(input.value).toBe("09:3015");
    expect(input.validationMessage).toBe(BAD_FORMAT_ERROR);
    expect(new FormData(view.getByRole("form", { name: "Time" }) as HTMLFormElement).get("start")).toBe("");
  });
});

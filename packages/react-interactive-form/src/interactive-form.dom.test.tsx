// Runs in the shared happy-dom (scripts/happy-dom.ts); see the root `test` script.
import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ReactNode } from "react";

type Testing = typeof import("@testing-library/react");
type UserEvent = (typeof import("@testing-library/user-event"))["userEvent"];
type Parts = typeof import("./index.js");
type Layout = typeof import("@tungv/react-reserve-layout");

let testing: Testing;
let userEvent: UserEvent;
let parts: Parts;
let layout: Layout;
const navigations: string[] = [];

beforeAll(async () => {
  await mock.module("next/navigation", () => ({
    useRouter: () => ({
      push: (href: string) => navigations.push(`push ${href}`),
      refresh: () => navigations.push("refresh"),
    }),
  }));
  testing = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).userEvent;
  parts = await import("./index.js");
  layout = await import("@tungv/react-reserve-layout");
});

beforeEach(() => {
  navigations.length = 0;
});

afterEach(() => testing.cleanup());

/** A promise the test settles, to hold an action pending. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function SaveButton() {
  const { SubmitButton, SubmitMessage, LoadingMessage } = parts;
  const { ReserveLayout } = layout;
  return (
    <SubmitButton>
      <ReserveLayout>
        <SubmitMessage>Save</SubmitMessage>
        <LoadingMessage>Saving…</LoadingMessage>
      </ReserveLayout>
    </SubmitButton>
  );
}

function Profile({ action }: { action: Parameters<Parts["InteractiveForm"]>[0]["action"] }) {
  const { InteractiveForm, FormErrorMessage, Success } = parts;
  return (
    <InteractiveForm aria-label="Profile" fields={["email"]} action={action}>
      <label>
        Email
        <input name="email" />
      </label>
      <FormErrorMessage name="email">That email is taken</FormErrorMessage>
      <FormErrorMessage>Fix the errors above</FormErrorMessage>
      <Success>
        <p>Saved</p>
      </Success>
      <SaveButton />
      <button type="reset">Reset</button>
    </InteractiveForm>
  );
}

describe("InteractiveForm", () => {
  test("sends the fields to the action and shows the errors it returns, for the field and the form", async () => {
    const user = userEvent.setup();
    const received: (string | null)[] = [];
    const view = testing.render(
      <Profile
        action={async (data) => {
          received.push(data.get("email"));
          return { errors: { email: ["taken"] } };
        }}
      />,
    );

    await user.type(view.getByLabelText("Email"), "a@example.com");
    await user.click(view.getByRole("button", { name: "Save" }));
    await view.findByText("That email is taken");
    expect(view.getByText("Fix the errors above")).toBeDefined();
    expect(view.queryByText("Saved")).toBeNull();
    expect(received).toEqual(["a@example.com"]);
    // What was typed stays for the person to correct.
    expect((view.getByLabelText("Email") as HTMLInputElement).value).toBe("a@example.com");

    // Changing the field clears its own error.
    await user.type(view.getByLabelText("Email"), "m");
    expect(view.queryByText("That email is taken")).toBeNull();
  });

  test("is inert while its action runs, and the submit button swaps its message without changing size", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ result: string }>();
    const view = testing.render(<Profile action={() => pending.promise} />);

    await user.click(view.getByRole("button", { name: "Save" }));
    const form = view.getByRole("form", { name: "Profile" });
    await testing.waitFor(() => expect(form.hasAttribute("inert")).toBe(true));
    const button = form.querySelector("button[type=submit]");
    expect(button?.hasAttribute("data-pending")).toBe(true);
    // Both labels stay in the button; the one not in use is hidden, so the button keeps its size.
    expect(button?.querySelector("[aria-hidden]")?.textContent).toBe("Save");

    await testing.act(async () => pending.resolve({ result: "ok" }));
    await view.findByText("Saved");
    expect(form.hasAttribute("inert")).toBe(false);
    expect(button?.querySelector("[aria-hidden]")?.textContent).toBe("Saving…");
  });

  test("a redirect result navigates with the router instead of showing anything", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Profile action={async () => ({ redirect: "/profile/done" })} />);

    await user.click(view.getByRole("button", { name: "Save" }));
    await testing.waitFor(() => expect(navigations).toEqual(["push /profile/done"]));
    expect(view.queryByText("Saved")).toBeNull();
  });

  test("a refresh result refreshes the route and still shows the result", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Profile action={async () => ({ refresh: true, result: "ok" })} />);

    await user.click(view.getByRole("button", { name: "Save" }));
    await view.findByText("Saved");
    expect(navigations).toEqual(["refresh"]);
  });

  test("reset clears errors and results", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Profile action={async () => ({ errors: { email: ["taken"] } })} />);

    await user.click(view.getByRole("button", { name: "Save" }));
    await view.findByText("That email is taken");
    await user.click(view.getByRole("button", { name: "Reset" }));
    await testing.waitFor(() => expect(view.queryByText("That email is taken")).toBeNull());
    expect(view.queryByText("Fix the errors above")).toBeNull();
  });
});

describe("FormBoundary and ActionButton", () => {
  test("a button outside the form runs its own action on the form's fields, then resets the form", async () => {
    const user = userEvent.setup();
    const received: (string | null)[] = [];
    const { FormBoundary, InteractiveForm, ActionButton, Success } = parts;
    function Layout({ children }: { children: ReactNode }) {
      return <section>{children}</section>;
    }
    const view = testing.render(
      <FormBoundary>
        <InteractiveForm aria-label="Album">
          <label>
            Title
            <input name="title" />
          </label>
        </InteractiveForm>
        <Layout>
          <ActionButton
            formAction={async (data) => {
              received.push(data.get("title"));
              return { result: "deleted" };
            }}
          >
            Delete
          </ActionButton>
          <Success>
            <p>Done</p>
          </Success>
        </Layout>
      </FormBoundary>,
    );

    await user.type(view.getByLabelText("Title"), "Holiday");
    await user.click(view.getByRole("button", { name: "Delete" }));
    await view.findByText("Done");
    expect(received).toEqual(["Holiday"]);
    expect((view.getByLabelText("Title") as HTMLInputElement).value).toBe("");
  });
});

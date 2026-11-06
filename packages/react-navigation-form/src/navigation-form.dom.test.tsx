// Runs in the shared happy-dom (scripts/happy-dom.ts); see the root `test` script.
import { afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";

type Testing = typeof import("@testing-library/react");
type UserEvent = (typeof import("@testing-library/user-event"))["userEvent"];
type Parts = typeof import("./index.js");

let testing: Testing;
let userEvent: UserEvent;
let parts: Parts;
const navigations: string[] = [];

beforeAll(async () => {
  await mock.module("next/navigation", () => ({
    useRouter: () => ({ push: (href: string) => navigations.push(href) }),
  }));
  testing = await import("@testing-library/react");
  userEvent = (await import("@testing-library/user-event")).userEvent;
  parts = await import("./index.js");
});

beforeEach(() => {
  navigations.length = 0;
});

afterEach(() => testing.cleanup());

/** The path and query of a pushed URL; the form pushes absolute URLs on the page's origin. */
const pathAndQuery = (href: string | undefined) => {
  const url = new URL(href ?? "", "http://localhost");
  return `${url.pathname}${url.search}`;
};

function Search({ preventReset }: { preventReset?: boolean }) {
  const { NavigationForm, NavigationButton } = parts;
  return (
    <NavigationForm action="/people" aria-label="Search" {...(preventReset ? { preventReset } : {})}>
      <label>
        Name
        <input name="q" defaultValue="" />
      </label>
      <label>
        <input type="checkbox" name="role" value="admin" defaultChecked />
        Admin
      </label>
      <label>
        <input type="checkbox" name="role" value="staff" defaultChecked />
        Staff
      </label>
      <button type="submit">Search</button>
      <NavigationButton searchParams={new URLSearchParams({ role: "admin" })}>Admins only</NavigationButton>
    </NavigationForm>
  );
}

describe("NavigationForm", () => {
  test("keeps native GET markup for a client without JavaScript", () => {
    const view = testing.render(<Search preventReset />);
    const form = view.getByRole("form", { name: "Search" });
    expect(form.getAttribute("data-slot")).toBe("navigation-form");
    expect(form.className).toBe("group");
  });

  test("submitting navigates to the action with every value, repeated names included", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Search preventReset />);

    await user.type(view.getByLabelText("Name"), "Ada Lovelace");
    await user.click(view.getByRole("button", { name: "Search" }));
    await testing.waitFor(() => expect(navigations).toHaveLength(1));
    expect(pathAndQuery(navigations[0])).toBe("/people?q=Ada+Lovelace&role=admin&role=staff");
    // preventReset keeps what was typed.
    expect((view.getByLabelText("Name") as HTMLInputElement).value).toBe("Ada Lovelace");
  });

  test("a NavigationButton goes to the form's action with its own query, not the form's fields", async () => {
    const user = userEvent.setup();
    const view = testing.render(<Search preventReset />);

    await user.type(view.getByLabelText("Name"), "Ada");
    await user.click(view.getByRole("button", { name: "Admins only" }));
    await testing.waitFor(() => expect(navigations).toHaveLength(1));
    expect(pathAndQuery(navigations[0])).toBe("/people?role=admin");
  });
});

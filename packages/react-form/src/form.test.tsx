import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Form, FormField, FormLabel, FormMessage, FormSubmit, InputControl } from "./index.js";

describe("form composition on the server", () => {
  test("ties the label to its control, names the control after its field, and starts valid", () => {
    const html = renderToStaticMarkup(
      <Form method="get" action="/search" className="search">
        <FormField name="email">
          <FormLabel>Email</FormLabel>
          <InputControl type="email" required />
          <FormMessage match="valueMissing">Enter your email</FormMessage>
        </FormField>
        <FormSubmit>Save</FormSubmit>
      </Form>,
    );
    const label = html.match(/<label[^>]*>/)?.[0] ?? "";
    const control = html.match(/<input[^>]*>/)?.[0] ?? "";
    const controlId = control.match(/id="([^"]+)"/)?.[1];
    expect(controlId).toBeDefined();
    expect(label).toContain(`for="${controlId}"`);
    expect(control).toContain('name="email"');
    expect(control).toContain('aria-required="true"');
    expect(control).toContain("data-valid");
    expect(control).not.toContain("aria-invalid");
    const form = html.match(/<form[^>]*>/)?.[0] ?? "";
    for (const attribute of ['data-slot="form"', 'method="get"', 'action="/search"', 'class="search"']) {
      expect(form).toContain(attribute);
    }
    expect(html).toContain('data-valid=""');
    // A message whose constraint has not failed is not rendered outside a ReserveLayout.
    expect(html).not.toContain("Enter your email");
    expect(html).toContain('type="submit"');
  });

  test("asChild controls keep the child element and its own props", () => {
    const html = renderToStaticMarkup(
      <Form>
        <FormField name="note">
          <FormLabel>Note</FormLabel>
          <InputControl asChild>
            <textarea rows={3} defaultValue="Draft" />
          </InputControl>
        </FormField>
      </Form>,
    );
    expect(html).toMatch(/<textarea[^>]*name="note"[^>]*rows="3"|<textarea[^>]*rows="3"[^>]*name="note"/);
    expect(html).toContain("Draft</textarea>");
  });
});

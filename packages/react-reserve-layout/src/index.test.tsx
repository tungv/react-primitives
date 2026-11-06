import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Hidden, ReserveLayout, Visible } from "./index.js";

describe("ReserveLayout", () => {
  test("renders every alternative in it, the hidden ones out of the accessibility tree and focus order", () => {
    const html = renderToStaticMarkup(
      <ReserveLayout className="button-label" placeItems="start">
        <Visible>Save</Visible>
        <Hidden>Saving…</Hidden>
      </ReserveLayout>,
    );
    expect(html).toBe(
      '<div data-slot="reserve-layout" class="button-label" data-place-items="start">' +
        '<span data-slot="reserve-layout-visible">Save</span>' +
        '<span data-slot="reserve-layout-hidden" aria-hidden="true" tabindex="-1">Saving…</span></div>',
    );
  });

  test("outside a ReserveLayout, Visible is its children and Hidden is nothing", () => {
    expect(
      renderToStaticMarkup(
        <>
          <Visible>Save</Visible>
          <Hidden>Saving…</Hidden>
        </>,
      ),
    ).toBe("Save");
  });

  test("places items in the centre unless told otherwise", () => {
    expect(renderToStaticMarkup(<ReserveLayout>x</ReserveLayout>)).toContain('data-place-items="center"');
  });
});

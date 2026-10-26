import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HoverHighlight, HoverHighlightGroup, HoverHighlightTarget, useHoverHighlightTarget } from "./index.js";

function Target() {
  return <div {...useHoverHighlightTarget()} />;
}

const anchorNames = (html: string) =>
  [...html.matchAll(/style="[^"]*anchor-name:(--[^;"]+)/g)].map(([, name]) => name);
const positionAnchors = (html: string) =>
  [...html.matchAll(/style="[^"]*position-anchor:(--[^;"]+)/g)].map(([, name]) => name);

const group = (targets: number) =>
  renderToStaticMarkup(
    <HoverHighlightGroup>
      {Array.from({ length: targets }, (_, index) => (
        <Target key={index} />
      ))}
      <HoverHighlight />
    </HoverHighlightGroup>,
  );

test("starts invisible and unanchored, because nothing is hovered yet", () => {
  const html = group(3);

  // Pure hover feedback: the first paint must not put a highlight on anything, or it would compete
  // with the active page's own styling before the pointer has said anything.
  expect(html).not.toMatch(/\sdata-visible[\s=>]/);
  // An anchor name that resolves to no element collapses the highlight to 0x0 at the end of the
  // group, so until a target is hovered there must be no `position-anchor` at all.
  expect(positionAnchors(html)).toEqual([]);
});

test("gives every target its own anchor name", () => {
  const names = anchorNames(group(3));
  expect(names).toHaveLength(3);
  expect(new Set(names).size).toBe(3);
});

test("turns React ids into valid dashed-idents without letting two of them collide", () => {
  // `useId` has shipped as both `_R_1_` and `«r1»`, and neither is a `<dashed-ident>`.
  const names = anchorNames(group(8));

  for (const name of names) {
    expect(name).toMatch(/^--[A-Za-z0-9_-]+$/u);
  }
  expect(new Set(names).size).toBe(names.length);
});

test("keeps targets in sibling groups on separate anchor names", () => {
  const html = renderToStaticMarkup(
    <>
      <HoverHighlightGroup>
        <Target />
        <HoverHighlight />
      </HoverHighlightGroup>
      <HoverHighlightGroup>
        <Target />
        <HoverHighlight />
      </HoverHighlightGroup>
    </>,
  );

  const [first, second] = anchorNames(html);
  expect(first).toBeDefined();
  expect(first).not.toBe(second);
});

test("keeps the highlight out of the accessibility tree", () => {
  expect(group(1)).toContain('aria-hidden="true"');
});

test("refuses to render the highlight outside a group, and a target outside one is inert", () => {
  expect(() => renderToStaticMarkup(<HoverHighlight />)).toThrow(/HoverHighlightGroup/);
  // A grid row calls the hook unconditionally, so outside a group it must render as a plain element.
  expect(renderToStaticMarkup(<Target />)).toBe("<div></div>");
});

test("a HoverHighlightTarget lays the target's props under its render element's own", () => {
  const html = renderToStaticMarkup(
    <HoverHighlightGroup render={<nav aria-label="Main" />}>
      <HoverHighlight className="fill" />
      <HoverHighlightTarget render={<a href="/home" className="link" data-slot="nav-link" />}>Home</HoverHighlightTarget>
      <HoverHighlightTarget className="plain">Plain</HoverHighlightTarget>
    </HoverHighlightGroup>,
  );
  expect(html).toMatch(/^<nav aria-label="Main" data-slot="hover-highlight-group" data-hover-highlight-group="">/);
  expect(html).toMatch(/<div data-slot="hover-highlight" class="fill" data-hover-highlight-fill="" aria-hidden="true">/);
  const link = html.match(/<a [^>]*>Home<\/a>/)?.[0] ?? "";
  for (const attribute of [/href="\/home"/, /class="link"/, /data-slot="nav-link"/, /data-hover-highlight-target=""/, /style="anchor-name:--hover-highlight-/]) {
    expect(link).toMatch(attribute);
  }
  expect(html).toMatch(/<div data-hover-highlight-target="" style="anchor-name:[^"]+" class="plain">Plain<\/div>/);
  expect(anchorNames(html)).toHaveLength(2);
  expect(() => renderToStaticMarkup(<HoverHighlightTarget />)).toThrow(/HoverHighlightGroup/);
});

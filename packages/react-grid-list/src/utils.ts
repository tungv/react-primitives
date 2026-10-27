const FOCUSABLE =
  "button, input:not([type='hidden']), select, textarea, a[href], summary, [tabindex], [contenteditable='true']";

const isFocusable = (element: HTMLElement): boolean => {
  if (element.closest("[inert], [hidden], [aria-hidden='true'], [data-disabled='true']"))
    return false;
  if (element.matches(":disabled, [aria-disabled='true']")) return false;
  const style = window.getComputedStyle(element);
  return (
    element.getClientRects().length > 0 && style.visibility !== "hidden" && style.display !== "none"
  );
};

/** Re-query on each key press: actions can be disabled, removed, or inserted live. */
export function getFocusableElements(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isFocusable);
}

/** A control inside a grid row, which the arrow keys reach and Tab never does. The row itself is not one. */
export function isRowAction(element: Element): boolean {
  const row = element.closest("[data-row-id]");
  return row !== null && row !== element;
}

/**
 * Where sequential focus navigation goes from `from`: the first tabbable element after it in document
 * order (before it, going backwards) that `accept` takes. Candidates are checked in order and the
 * search stops at the first match, so a Tab reads the style of the few elements it passes over
 * rather than of every focusable element on the page.
 */
export function sequentialFocusTarget(
  from: Element | null,
  backwards: boolean,
  accept: (element: HTMLElement) => boolean = () => true,
): HTMLElement | undefined {
  const candidates = Array.from(document.body.querySelectorAll<HTMLElement>(FOCUSABLE));
  const origin = from && from !== document.body ? from : null;
  const side = backwards ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
  const beyond = (element: HTMLElement) =>
    !origin || Boolean(origin.compareDocumentPosition(element) & side);
  return (backwards ? candidates.reverse() : candidates).find(
    (element) =>
      element !== origin &&
      element.tabIndex >= 0 &&
      beyond(element) &&
      accept(element) &&
      isFocusable(element),
  );
}

export function safelyFocusElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  element.focus();
  return document.activeElement === element;
}

/** A row kept mounted while collapsed (a pile with a selection) stays out of tab order and arrow-key traversal. */
export function isRowVisible(element: HTMLElement): boolean {
  return element.getClientRects().length > 0;
}

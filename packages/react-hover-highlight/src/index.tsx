"use client";

// Its geometry, motion and the targets' blanked hover fill are in styles.css (`@tungv/react-hover-highlight/styles.css`),
// keyed on the `data-hover-highlight-*` attributes each part carries.
import {
  cloneElement,
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  type ReactElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Slot, mergeRefs, mergeSlotProps } from "@tungv/react-slot";

/**
 * One highlight that follows the pointer across the targets of a group, positioned entirely by CSS
 * anchor positioning. It says "you are pointing here" and nothing else — the current page keeps its
 * own active styling, so the two never compete — and it fades out whenever nothing is hovered.
 *
 * Sizing and position are headless: every number comes from the target underneath it, so a consumer
 * only adds classes that say how it *looks*.
 *
 * ```tsx
 * <HoverHighlightGroup>
 *   <HoverHighlight className="rounded-md bg-neutral-100" />
 *   {items.map((item) => (
 *     <HoverHighlightTarget key={item.href} render={<a href={item.href} />}>{item.name}</HoverHighlightTarget>
 *   ))}
 * </HoverHighlightGroup>
 * ```
 *
 * A component that renders its own element spreads `useHoverHighlightTarget()` onto it instead.
 *
 * React only ever passes a *name* around; the browser does the measuring, so the highlight stays glued
 * through scrolling, reflow and animated layout without a ResizeObserver or a single measurement.
 */
type HoverHighlightSnapshot = {
  /** Anchor name the highlight sits on; null until a target has been hovered or focused. */
  anchor: string | null;
  /** False whenever nothing is hovered or focused, which is the resting state. */
  visible: boolean;
};

/**
 * The group's state lives in a store rather than in context, because a group can wrap rows that are
 * still streaming in: React delivers a context change into a Suspense boundary it has not hydrated yet
 * by hydrating it, synchronously on a hover's lane, one boundary per commit — enough of them and it
 * reports "Maximum update depth exceeded" (see the README). The context carries only
 * this object, whose identity never changes, and the highlight subscribes to what moves without
 * rendering.
 */
type HoverHighlightStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => HoverHighlightSnapshot;
  enter: (name: string) => void;
  leave: (name: string) => void;
  focus: (name: string) => void;
  blur: (name: string) => void;
  release: (name: string) => void;
  /** The pointer left the group outright. */
  exit: () => void;
};

const createHoverHighlightStore = (): HoverHighlightStore => {
  let pointed: string | null = null;
  let focused: string | null = null;
  let previous: string | null = null;
  let snapshot: HoverHighlightSnapshot = { anchor: null, visible: false };
  const listeners = new Set<() => void>();

  const publish = () => {
    // Whichever input moved last wins: a focus-visible event clears the pointer, so a mouse parked on
    // one row cannot outrank the keyboard for the rest of the session.
    const active = pointed ?? focused;
    // Never cleared once anything has been active: an anchor that resolves to nothing collapses the
    // highlight to 0x0, and the fade-out would show it happen. The last valid name is held on to and
    // only the opacity is dropped.
    const anchor = active ?? previous;
    const visible = active !== null;
    if (anchor === snapshot.anchor && visible === snapshot.visible) return;
    snapshot = { anchor, visible };
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    enter: (name) => {
      pointed = name;
      previous = name;
      publish();
    },
    leave: (name) => {
      if (pointed === name) pointed = null;
      publish();
    },
    focus: (name) => {
      focused = name;
      pointed = null;
      previous = name;
      publish();
    },
    blur: (name) => {
      if (focused === name) focused = null;
      publish();
    },
    release: (name) => {
      if (pointed === name) pointed = null;
      if (focused === name) focused = null;
      publish();
    },
    exit: () => {
      pointed = null;
      publish();
    },
  };
};

const HoverHighlightContext = createContext<HoverHighlightStore | null>(null);

const useHoverHighlightGroup = (component: string): HoverHighlightStore => {
  const group = useContext(HoverHighlightContext);
  if (group === null) {
    throw new Error(`${component} must be rendered inside a HoverHighlightGroup.`);
  }
  return group;
};

/**
 * Anchor names are `<dashed-ident>`s and React's `useId` is not one: it has shipped as `_R_1_` and as
 * `«r1»` across 19.x, with a host-configurable prefix. Encoding every character outside the name set
 * as its code point, with a terminator, keeps the mapping prefix-free and so injective — two ids can
 * never collide on one anchor name.
 */
const anchorName = (id: string) =>
  `--hover-highlight-${id.replace(/[^a-zA-Z0-9]/gu, (char) => `_${char.codePointAt(0)?.toString(16) ?? ""}_`)}`;

/**
 * `matches()` throws `SyntaxError` on a selector it cannot parse, and a browser old enough to lack
 * `:focus-visible` is exactly the browser that also lacks anchor positioning and is relying on the
 * fallback — so a keyboard focus there must not take the page down with it. Those browsers hide the
 * highlight anyway, which is why falling back to plain focus costs nothing.
 */
const focusIsVisible = (element: Element): boolean => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

/** A `render` element takes the part's props under its own, as `asChild` does; without one it is a `div`. */
type RenderProps = { render?: ReactElement | undefined };

type PartProps = ComponentProps<"div"> & { [attribute: `data-${string}`]: string | undefined };

/** The part's children go inside the `render` element, unless the part has none and the element brings its own. */
const renderPart = (render: ReactElement | undefined, { ref, children, ...props }: PartProps): ReactElement =>
  render ? (
    <Slot {...props} ref={ref}>
      {children === undefined ? render : cloneElement(render, undefined, children)}
    </Slot>
  ) : (
    <div {...props} ref={ref}>
      {children}
    </div>
  );

/**
 * The scope the highlight moves within, and the containing block it is positioned against. It
 * isolates its stacking, which is load-bearing: a surface that paints its own background would
 * otherwise hide the highlight's `z-index: -1` behind it (styles.css).
 */
export const HoverHighlightGroup = ({ onPointerLeave, render, ...props }: ComponentProps<"div"> & RenderProps) => {
  const [store] = useState(createHoverHighlightStore);
  return (
    <HoverHighlightContext value={store}>
      {renderPart(render, {
        "data-slot": "hover-highlight-group",
        ...props,
        "data-hover-highlight-group": "",
        // The backstop for leaving the group outright. Targets clear themselves, so this only has to
        // catch a pointer that exits without passing back over one.
        onPointerLeave: (event) => {
          if (event.pointerType !== "touch") {
            store.exit();
          }
          onPointerLeave?.(event);
        },
      })}
    </HoverHighlightContext>
  );
};

/**
 * The moving element. Give it a className for the looks; it owns nothing but its geometry.
 *
 * It never re-renders on a hover: the store's subscription writes the anchor name and `data-visible`
 * straight onto the element. A hover is a discrete event, so a React update from it would render
 * synchronously on every row the pointer crosses; a CSS-positioned highlight needs nothing from React
 * but a name, so hovering stays out of React's scheduling altogether.
 */
export const HoverHighlight = ({ ref, render, ...props }: ComponentProps<"div"> & RenderProps): ReactElement => {
  const group = useHoverHighlightGroup("HoverHighlight");
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paint = () => {
      const element = elementRef.current;
      if (element === null) return;
      const { anchor, visible } = group.getSnapshot();
      if (anchor === null) element.style.removeProperty("position-anchor");
      else element.style.setProperty("position-anchor", anchor);
      element.toggleAttribute("data-visible", visible);
    };
    paint();
    return group.subscribe(paint);
  }, [group]);

  return renderPart(render, {
    "data-slot": "hover-highlight",
    ...props,
    "data-hover-highlight-fill": "",
    ref: ref ? mergeRefs<HTMLDivElement>(elementRef, ref) : elementRef,
    "aria-hidden": "true",
  });
};

/**
 * The props that make an element a target: its anchor name, and the pointer and focus handlers that
 * move the highlight onto it. Returns nothing outside a group, so a component that is only sometimes
 * rendered inside one (a grid row) can call it unconditionally. Merge them so the handlers chain rather
 * than replace the element's own (`HoverHighlightTarget` and `withHoverTarget` in components.tsx do).
 */
export type HoverHighlightTargetProps = Pick<
  HTMLAttributes<HTMLElement>,
  "style" | "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur"
> & { "data-hover-highlight-target"?: "" };

export const useHoverHighlightTarget = (): HoverHighlightTargetProps => {
  const group = useContext(HoverHighlightContext);
  const name = anchorName(useId());

  // React fires no blur when a focused element is removed, so a target that unmounts while it holds
  // the highlight would pin the group to an anchor nothing owns, and the highlight would never fade.
  // Releasing on unmount is the only signal there is.
  useEffect(() => (group === null ? undefined : () => group.release(name)), [group, name]);

  if (group === null) return {};
  return {
    // Marks the element whose own hover fill styles.css blanks while the highlight can paint.
    "data-hover-highlight-target": "",
    style: { anchorName: name },
    // A tap is not a hover: on a touch screen the highlight would stick to whatever was pressed
    // last, so only a real pointer moves it.
    onPointerEnter: (event) => {
      if (event.pointerType !== "touch") {
        group.enter(name);
      }
    },
    // Leaving a target matters as much as entering one: a group wraps plenty that is not a target,
    // and without this the highlight would sit on the row the pointer left until it quit the group
    // entirely. Moving straight to the next target still does not blink: the browser dispatches
    // this leave and that enter in one task, so React renders them together.
    onPointerLeave: (event) => {
      if (event.pointerType !== "touch") {
        group.leave(name);
      }
    },
    // `:focus-visible` rather than `:focus`, or a click would park the highlight on the item you
    // pressed and leave it fighting the pointer.
    onFocus: (event) => {
      if (focusIsVisible(event.currentTarget)) {
        group.focus(name);
      }
    },
    onBlur: () => group.blur(name),
  };
};

/**
 * Makes an element a target without a hook: a `div`, or the `render` element with the target's props
 * laid under its own. It keeps the element's own `data-slot`.
 */
export const HoverHighlightTarget = ({ ref, render, ...props }: ComponentProps<"div"> & RenderProps): ReactElement => {
  useHoverHighlightGroup("HoverHighlightTarget");
  const target = useHoverHighlightTarget();
  return renderPart(render, { ...(mergeSlotProps(target, props) as PartProps), ref });
};

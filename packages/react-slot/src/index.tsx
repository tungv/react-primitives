// No "use client": nothing here holds state, so a server component can render a Slot too.
// `composeRefs` and `useComposedRefs` are from tungv/demo-gallery-app (src/utils/compose-refs.tsx).
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from "react";

/** Joins the class names that are set, ours first so a child's own classes can follow them. */
export const cn = (...names: (string | false | null | undefined)[]): string | undefined =>
  names.filter(Boolean).join(" ") || undefined;

type Props = Record<string, unknown>;

/** Both handlers run, the slot's first; the child's own still sees the event. */
const chain = (ours: unknown, theirs: unknown) =>
  typeof ours === "function" && typeof theirs === "function"
    ? (...args: unknown[]) => {
        (ours as (...a: unknown[]) => void)(...args);
        (theirs as (...a: unknown[]) => void)(...args);
      }
    : (theirs ?? ours);

type PossibleRef<T> = Ref<T> | undefined;

/** Sets one ref, callback or object; returns a callback ref's React 19 cleanup, if it gave one. */
function setRef<T>(ref: PossibleRef<T>, value: T | null): void | (() => void) {
  if (typeof ref === "function") return ref(value);
  if (ref !== null && ref !== undefined) ref.current = value;
}

/**
 * One callback ref that sets every ref given, callback or object. When any callback ref returns a React 19
 * cleanup, the composed ref returns one too, which runs those cleanups and nulls the other refs.
 */
export function composeRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === "function") hasCleanup = true;
      return cleanup;
    });
    // React before 19 logs an error when a callback ref returns a value; that only happens here if one
    // of the given refs returned a cleanup, which only React 19 code does.
    if (hasCleanup) {
      return () => {
        cleanups.forEach((cleanup, index) => {
          if (typeof cleanup === "function") cleanup();
          else setRef(refs[index], null);
        });
      };
    }
    return undefined;
  };
}

/** `composeRefs`, kept stable across renders while the refs are. */
export function useComposedRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are the dependencies.
  return useCallback(composeRefs(...refs), refs);
}

/** The earlier name of `composeRefs`. */
export const mergeRefs = composeRefs;

/** Props laid under a child's own: handlers chained, class names joined, styles merged, refs both set. */
export function mergeSlotProps(ours: Props, theirs: Props): Props {
  const merged: Props = { ...ours, ...theirs };
  for (const key of Object.keys(ours)) {
    if (/^on[A-Z]/.test(key)) merged[key] = chain(ours[key], theirs[key]);
  }
  merged["className"] = cn(ours["className"] as string | undefined, theirs["className"] as string | undefined);
  if (ours["style"] || theirs["style"]) merged["style"] = { ...(ours["style"] as object | undefined), ...(theirs["style"] as object | undefined) };
  return merged;
}

/** Any element's props: a Slot renders whatever element it is given, so it takes that element's props. */
export type SlotProps = { children?: ReactNode; ref?: unknown } & Record<string, unknown>;

/** Keeps the reference's asChild API: the one child element is rendered with these props merged into its own. */
export function Slot({ children, ref, ...props }: SlotProps) {
  const child = Children.only(children);
  if (!isValidElement<Props>(child)) return null;
  const childRef = (child.props["ref"] as Ref<HTMLElement> | undefined) ?? undefined;
  return cloneElement(child as ReactElement<Props>, {
    ...mergeSlotProps(props as Props, child.props),
    ref: mergeRefs(ref as Ref<HTMLElement> | undefined, childRef),
  });
}

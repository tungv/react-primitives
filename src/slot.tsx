"use client";

import { Children, cloneElement, isValidElement, type ComponentPropsWithRef, type ReactElement, type Ref } from "react";
import { cn } from "./utils.js";

type Props = Record<string, unknown>;

/** Both handlers run, the slot's first; the child's own still sees the event. */
const chain = (ours: unknown, theirs: unknown) =>
  typeof ours === "function" && typeof theirs === "function"
    ? (...args: unknown[]) => {
        (ours as (...a: unknown[]) => void)(...args);
        (theirs as (...a: unknown[]) => void)(...args);
      }
    : (theirs ?? ours);

export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref) ref.current = value;
    }
  };
}

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

/** Keeps the reference's asChild API: the one child element is rendered with these props merged into its own. */
export function Slot({ children, ref, ...props }: ComponentPropsWithRef<"div">) {
  const child = Children.only(children);
  if (!isValidElement<Props>(child)) return null;
  const childRef = (child.props["ref"] as Ref<HTMLElement> | undefined) ?? undefined;
  return cloneElement(child as ReactElement<Props>, {
    ...mergeSlotProps(props as Props, child.props),
    ref: mergeRefs(ref as Ref<HTMLElement> | undefined, childRef),
  });
}

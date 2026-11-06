"use client";

// From tungv/demo-gallery-app (src/components/ui/reserve-layout.tsx). Its Tailwind classes are in styles.css,
// keyed on each part's `data-slot`.
import { createContext, useContext } from "react";
import type { ComponentProps } from "react";

const ReserveLayoutContext = createContext(false);

/**
 * Utility component for avoiding layout shifts when swapping different contents. Every child sits in the
 * same grid cell, so the alternatives that are hidden still reserve their size, and the container is as
 * large as the largest of them.
 *
 * ## Anatomy
 *
 * ```jsx
 * <ReserveLayout>
 *   <Hidden>
 *     <span>Content</span>
 *   </Hidden>
 *   <Visible>
 *     <span>Content</span>
 *   </Visible>
 * </ReserveLayout>
 * ```
 */
export function ReserveLayout({
  children,
  placeItems = "center",
  ...divProps
}: ComponentProps<"div"> & {
  placeItems?: "start" | "center" | "end" | "stretch" | "baseline";
}) {
  return (
    <ReserveLayoutContext.Provider value={true}>
      <div data-slot="reserve-layout" {...divProps} data-place-items={placeItems}>
        {children}
      </div>
    </ReserveLayoutContext.Provider>
  );
}

/** Keeps its size in a ReserveLayout while out of sight, focus order and the accessibility tree; outside one, renders nothing. */
export function Hidden({ children, ...spanProps }: ComponentProps<"span">) {
  const isReserveLayout = useContext(ReserveLayoutContext);
  return isReserveLayout ? (
    <span data-slot="reserve-layout-hidden" {...spanProps} aria-hidden tabIndex={-1}>
      {children}
    </span>
  ) : null;
}

/** Shows its children; in a ReserveLayout, in a span that takes the shared cell. */
export function Visible({ children, ...spanProps }: ComponentProps<"span">) {
  const isReserveLayout = useContext(ReserveLayoutContext);
  return isReserveLayout ? (
    <span data-slot="reserve-layout-visible" {...spanProps}>
      {children}
    </span>
  ) : (
    children
  );
}

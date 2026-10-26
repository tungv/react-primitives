"use client";

// Every part carries a `data-slot` for styling it from outside; the parts' own layout and looks are in
// styles.css, keyed on those slots, so a consumer's classes always win over them. See README.md.
import {
  HoverHighlight,
  HoverHighlightGroup,
  type HoverHighlightTargetProps,
  useHoverHighlightTarget,
} from "@tungv/hover-highlight";
import { Slot } from "@tungv/slot";
import {
  useContext,
  useEffect,
  useId,
  useCallback,
  memo,
  useMemo,
  useState,
  useRef,
  use,
} from "react";
import type { FormEventHandler, HTMLAttributes, MouseEvent, ReactNode } from "react";

import type { GridListContentProps, SelectionAction, SelectionState } from "./types.js";
import type {
  GridListRootProps,
  GridListRowProps,
  GridListColumnHeaderProps,
  GridListRowHeaderProps,
  GridListTitleProps,
  GridListCaptionProps,
  GridListCellProps,
} from "./types.js";
import {
  SelectionStateProvider,
  GridStoresContext,
  GridListConfigContext,
  createGridStores,
  ControlledValueContext,
  RowContext,
  GridListBodyContext,
  SelectionIndicatorContext,
  useSelectionState,
  useSelectedRows,
  useHeldSelection,
  selectedRowsAmong,
  selectableRowIds,
  selectionIdsInRange,
  useGridDataState,
  useGridRowsStore,
  useSelectionDispatch,
  useGridListConfig,
  useGridListDispatch,
  useGridFocus,
  useGridFocusStore,
  useGridLabelingState,
  useGridLabelingDispatch,
  selectionReducer,
  GridContentContext,
  GridAccessibilityContext,
} from "./state.js";
import {
  useRegisterRow,
  useHandleSpacebar,
  useGridListTabIndexManager,
  useGridListKeyboardHandlers,
} from "./hooks.js";

/**
 * A grid's fixed settings and its stores (`createGridStores`). Neither value changes when rows
 * register or focus moves, so nothing here reaches a row boundary that has not hydrated yet.
 */
function GridListStateProvider({
  children,
  cycleRowFocus,
  name,
  required,
}: {
  children: ReactNode;
  cycleRowFocus: boolean;
  name?: string | undefined;
  required?: boolean | undefined;
}) {
  const [stores] = useState(createGridStores);
  const config = useMemo(
    () => ({ cycleRowFocus, name, required, _default: false }),
    [cycleRowFocus, name, required],
  );
  return (
    <GridListConfigContext value={config}>
      <GridStoresContext value={stores}>{children}</GridStoresContext>
    </GridListConfigContext>
  );
}

export function GridListContainer({
  children,
  className,
  cycleRowFocus = false,
  selectionMode = "none",
  name,
  required = false,
  initialValue,
  value,
  onValueChange,
  onInvalid,
  ...divProps
}: GridListRootProps) {
  const isControlled = typeof value !== "undefined";
  const label = divProps["aria-label"];
  const labelledBy = divProps["aria-labelledby"];
  const describedBy = divProps["aria-describedby"];
  const readOnly = divProps["aria-readonly"];
  const accessibility = useMemo(
    () => ({
      "aria-label": label,
      "aria-labelledby": labelledBy,
      "aria-describedby": describedBy,
      "aria-readonly": readOnly,
    }),
    [label, labelledBy, describedBy, readOnly],
  );

  const onValueChangeEvent = useCallback(
    (rows: Set<string>) => {
      if (typeof onValueChange === "function") {
        const selectedArray = Array.from(rows);
        const valueToEmit = selectionMode === "multiple" ? selectedArray : selectedArray[0] || "";

        if (selectionMode === "multiple") {
          (onValueChange as (value: string[]) => void)(selectedArray);
        } else {
          (onValueChange as (value: string) => void)(valueToEmit as string);
        }
      }
    },
    [onValueChange, selectionMode],
  );

  // Create initial selectedRows set based on initialValue (only used once, not reactive)
  const [initialSelectedRows] = useState(() => {
    const actualInitialValue = typeof value !== "undefined" ? value : initialValue;

    if (!actualInitialValue || selectionMode === "none") {
      return new Set<string>();
    }

    if (selectionMode === "single") {
      return typeof actualInitialValue === "string"
        ? new Set<string>([actualInitialValue])
        : new Set<string>();
    }

    if (selectionMode === "multiple") {
      return Array.isArray(actualInitialValue)
        ? new Set<string>(actualInitialValue)
        : new Set<string>();
    }

    return new Set<string>();
  });

  const selectionMiddleware = useCallback(
    (
      dispatch: ReturnType<typeof useSelectionDispatch>,
      getNextState: (action: SelectionAction) => SelectionState,
    ) =>
      (action: SelectionAction) => {
        // If controlled, don't dispatch to internal state
        if (typeof value !== "undefined") {
          // apply the reducer logic on the controlled state
          const state = selectionReducer(
            {
              selectionMode,
              selectedRows: new Set(Array.isArray(value) ? value : value ? [value] : []),
            },
            action,
          );

          onValueChangeEvent(state.selectedRows);

          return;
        }

        // Apply the action to get the next state
        dispatch(action);
        const state = getNextState(action);

        onValueChangeEvent(state.selectedRows);
      },
    [onValueChangeEvent, selectionMode, value],
  );

  const reactiveValue = useMemo(() => {
    if (typeof value === "undefined") return new Set<string>();
    if (Array.isArray(value)) return new Set<string>(value);
    return new Set<string>([value]);
  }, [value]);

  const containerInner = (
    <div data-slot="grid-list-container" className={className} {...divProps}>
      {children}
      <HiddenSelectionInput onInvalid={onInvalid} />
    </div>
  );

  const optionalControlled = isControlled ? (
    <ControlledValueContext value={reactiveValue}>{containerInner}</ControlledValueContext>
  ) : (
    containerInner
  );

  return (
    <GridListStateProvider cycleRowFocus={cycleRowFocus} name={name} required={required}>
      <SelectionStateProvider
        selectionMode={selectionMode}
        selectedRows={initialSelectedRows}
        middleware={selectionMiddleware}
      >
        <GridAccessibilityContext value={accessibility}>
          {optionalControlled}
        </GridAccessibilityContext>
      </SelectionStateProvider>
    </GridListStateProvider>
  );
}

export function GridListContent({
  children,
  gridClassName,
  scrollableContainerClassName,

  scrollable = false,
  ...divProps
}: GridListContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentContext = useMemo(() => ({ containerRef }), []);

  return (
    <GridContentContext.Provider value={contentContext}>
      {/* The wrapper scrolls a grid that is wider than its column, and the grid clips (styles.css). */}
      <div
        data-slot="grid-list-scroll"
        data-scrollable={scrollable ? "" : undefined}
        className={scrollableContainerClassName}
      >
        <GridListContentInner {...divProps} className={gridClassName}>
          {children}
        </GridListContentInner>
      </div>
    </GridContentContext.Provider>
  );
}

function GridListContentInner({
  children,
  className,
  ...divProps
}: React.HTMLAttributes<HTMLDivElement>) {
  const isFocusWithinContainer = useGridFocus((state) => state.isFocusWithinContainer);
  const dispatch = useGridListDispatch();
  const lastFocusedRowId = useGridFocus((state) => state.lastFocusedRowId);

  const { containerRef } = useContext(GridContentContext);

  // Effect to validate the currently focused row still exists
  useEffect(() => {
    if (!lastFocusedRowId || !containerRef?.current) return;

    const rowElement = containerRef.current.querySelector(
      `[data-row-id="${CSS.escape(lastFocusedRowId)}"]`,
    );
    if (!rowElement) {
      // If the focused row no longer exists, clear the focus
      dispatch({
        type: "setLastFocusedRow",
        rowId: null,
      });
    }
  }, [lastFocusedRowId, containerRef, dispatch]);

  const handleKeyDown = useGridListKeyboardHandlers();

  const { labelIds, captionIds } = useGridLabelingState();
  const accessibility = useContext(GridAccessibilityContext);
  const { selectionMode } = useSelectionState();

  // Combine manual ARIA props with registered label/caption IDs
  const combinedLabelledBy =
    [
      ...(divProps["aria-labelledby"] ? divProps["aria-labelledby"].split(/\s+/) : []),
      ...(accessibility["aria-labelledby"]?.split(/\s+/) ?? []),
      ...labelIds,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const combinedDescribedBy =
    [
      ...(divProps["aria-describedby"] ? divProps["aria-describedby"].split(/\s+/) : []),
      ...(accessibility["aria-describedby"]?.split(/\s+/) ?? []),
      ...captionIds,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  const innerProps: HTMLAttributes<HTMLDivElement> & {
    "data-slot": string;
    "data-focused"?: string | undefined;
  } = {
    "data-slot": "grid-list",
    ...divProps,
    className,
    role: "grid",
    "aria-label": divProps["aria-label"] ?? accessibility["aria-label"],
    "aria-readonly": divProps["aria-readonly"] ?? accessibility["aria-readonly"],
    "aria-multiselectable": selectionMode === "none" ? undefined : selectionMode === "multiple",
    tabIndex: -1,
    "data-focused": isFocusWithinContainer ? "true" : undefined,
    "aria-labelledby": combinedLabelledBy,
    "aria-describedby": combinedDescribedBy,
    onKeyDown: (event) => {
      divProps.onKeyDown?.(event);
      if (!event.defaultPrevented) handleKeyDown(event);
    },

    onFocusCapture: (event) => {
      dispatch({
        type: "setFocusWithinContainer",
        isFocusWithinContainer: true,
      });
      divProps.onFocusCapture?.(event);
    },
    onBlurCapture: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        dispatch({
          type: "setFocusWithinContainer",
          isFocusWithinContainer: false,
        });
      }
      divProps.onBlurCapture?.(event);
    },
  };

  useGridListTabIndexManager(children);

  // The grid is a hover-highlight group and its body rows are the targets, so one fill glides between
  // rows instead of each row lighting its own. The group keeps its moving state in a store, never in
  // context, so a hover cannot force the rows still streaming in to hydrate (see README).
  return (
    <HoverHighlightGroup {...innerProps} ref={containerRef}>
      <HoverHighlight data-slot="grid-list-highlight" />
      {children}
    </HoverHighlightGroup>
  );
}

function HiddenSelectionInput({
  onInvalid,
}: {
  onInvalid?: FormEventHandler<HTMLSelectElement> | undefined;
}) {
  const { selectionMode } = useSelectionState();
  const { name, required } = useGridListConfig();
  // Only a named grid submits the focused row, so only a named grid re-renders this when focus moves.
  const lastFocusedRowId = useGridFocus((state) => (name ? state.lastFocusedRowId : null));
  const selectedRows = useSelectedRows();

  if (!name) {
    return null;
  }

  const selectedArray = Array.from(selectedRows);
  const isMultiple = selectionMode === "multiple";
  const selectValue = isMultiple ? selectedArray : selectedArray[0] || "";

  return (
    <>
      {selectionMode !== "none" && (
        <select
          hidden
          name={name}
          multiple={isMultiple}
          value={selectValue}
          onChange={() => {}}
          onInvalid={onInvalid}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
        >
          {selectedArray.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      )}
      {lastFocusedRowId ? (
        <input
          hidden
          name={`${name}.focused`}
          value={lastFocusedRowId}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}

export const GridHeader = memo(function GridHeader({
  children,
  className,
  ...divProps
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const dispatch = useSelectionDispatch();
  const { rows } = useGridDataState();
  const { selectionMode } = useSelectionState();
  const selectedRows = useSelectedRows();

  const headerProps = {
    "data-slot": "grid-list-rowgroup",
    ...divProps,
    className,
    role: "rowgroup",
  };

  // only wrap the context if we are in multiple selection mode
  if (selectionMode !== "multiple") {
    return <header {...headerProps}>{children}</header>;
  }

  // Only consider selectable rows (not disabled or read-only), counting a pile's members
  const selectableIds = selectableRowIds(rows);

  // Count how many selectable rows are currently selected
  const selectedSelectableRowsCount = selectableIds.filter((rowId) =>
    selectedRows.has(rowId),
  ).length;

  const isEmpty = selectedSelectableRowsCount === 0;
  const isAllSelected = !isEmpty && selectedSelectableRowsCount === selectableIds.length;

  const isIndeterminate = !isEmpty && !isAllSelected;

  return (
    <SelectionIndicatorContext
      value={{
        selected: isIndeterminate ? "indeterminate" : isAllSelected,
        onCheckedChange: (isCheckingEverything) => {
          // if isCheckingEverything is true, we need to check all selectable rows. Otherwise, we need to uncheck all rows.
          if (isCheckingEverything) {
            dispatch({
              type: "selectAllRows",
              allRows: rows,
            });
          } else {
            dispatch({ type: "clearSelection", rows });
          }
        },
      }}
    >
      <header {...headerProps}>{children}</header>
    </SelectionIndicatorContext>
  );
});

export function GridBody({
  children,
  className,
  ...divProps
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const bodyProps = {
    ...divProps,
    role: "rowgroup",
  };
  return (
    <GridListBodyContext value={true}>
      <div data-slot="grid-list-rowgroup" className={className} {...bodyProps}>
        {children}
      </div>
    </GridListBodyContext>
  );
}

export function GridFooter({
  children,
  className,
  ...divProps
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const footerProps = {
    ...divProps,
    role: "rowgroup",
  };
  return (
    <footer data-slot="grid-list-rowgroup" className={className} {...footerProps}>
      {children}
    </footer>
  );
}

export function GridListTitle({
  children,
  className,
  asChild,
  ...headingProps
}: GridListTitleProps) {
  const dispatch = useGridLabelingDispatch();

  const titleId = useId();

  // Register this title ID when component mounts
  useEffect(() => {
    dispatch({ type: "addLabel", id: titleId });
    return () => {
      dispatch({ type: "removeLabel", id: titleId });
    };
  }, [dispatch, titleId]);

  const titleProps = {
    "data-slot": "grid-list-title",
    ...headingProps,
    id: titleId,
    className,
  };

  const titleElement = asChild ? (
    <Slot {...titleProps}>{children}</Slot>
  ) : (
    <h2 {...titleProps}>{children}</h2>
  );

  // Belongs inside a GridListContainer and outside its GridListContent (README).
  return titleElement;
}

export function GridListCaption({
  children,
  className,
  asChild,
  ...divProps
}: GridListCaptionProps) {
  const dispatch = useGridLabelingDispatch();

  const captionId = useId();

  // Register this caption ID when component mounts
  useEffect(() => {
    dispatch({ type: "addCaption", id: captionId });
    return () => {
      dispatch({ type: "removeCaption", id: captionId });
    };
  }, [dispatch, captionId]);

  const captionProps = {
    "data-slot": "grid-list-caption",
    ...divProps,
    id: captionId,
    className,
  };

  const captionElement = asChild ? (
    <Slot {...captionProps}>{children}</Slot>
  ) : (
    <p {...captionProps}>{children}</p>
  );

  // Belongs inside a GridListContainer and outside its GridListContent (README).
  return captionElement;
}

/** A row's own props with the hover-highlight target's laid under them, handlers chained rather than replaced. */
const withHoverTarget = (
  target: HoverHighlightTargetProps,
  props: React.HTMLAttributes<HTMLDivElement>,
): React.HTMLAttributes<HTMLDivElement> => ({
  ...(target["data-hover-highlight-target"] === undefined ? {} : { "data-hover-highlight-target": "" }),
  ...props,
  style: { ...target.style, ...props.style },
  onPointerEnter: (event) => {
    target.onPointerEnter?.(event);
    props.onPointerEnter?.(event);
  },
  onPointerLeave: (event) => {
    target.onPointerLeave?.(event);
    props.onPointerLeave?.(event);
  },
  onFocus: (event) => {
    target.onFocus?.(event);
    props.onFocus?.(event);
  },
  onBlur: (event) => {
    target.onBlur?.(event);
    props.onBlur?.(event);
  },
});

export const GridListRow = function GridListRow({
  children,
  className,
  asChild,
  rowId,
  readOnly,
  disabled,
  rowData,
  selectionIds,
  ...divProps
}: GridListRowProps) {
  const dispatch = useGridListDispatch();
  const focusStore = useGridFocusStore();
  const selectionDispatch = useSelectionDispatch();
  const { selectionMode } = useSelectionState();
  // Never the registry itself here: it changes as each row hydrates, and every row would re-render.
  const selection = useHeldSelection();
  const rowsStore = useGridRowsStore();
  const { containerRef } = useContext(GridContentContext);
  const isInBody = useContext(GridListBodyContext);

  const autoGeneratedRowId = useId();
  const actualRowId = rowId ?? autoGeneratedRowId;
  // A boolean per row, so moving focus re-renders the row it left and the row it entered, no others.
  const isLastFocusedRow = useGridFocus((state) => state.lastFocusedRowId === actualRowId);

  // Check if row is selected
  const isRowSelected = selectionMode !== "none" && selection.has(actualRowId);

  const rowProps: React.HTMLAttributes<HTMLDivElement> & {
    "data-slot": string;
    "data-row-id": string;
    "data-focused"?: string | undefined;
    "data-restore-focus"?: string | undefined;
    "data-selected"?: string | undefined;
    "data-readonly"?: string | undefined;
    "data-disabled"?: string | undefined;
    "data-header-row"?: string | undefined;
  } = {
    "data-slot": "grid-list-row",
    ...divProps,
    role: "row",
    tabIndex: disabled ? -1 : isLastFocusedRow ? 0 : -1,
    className,
    ...gridRowAttributes({
      readOnly,
      disabled,
      selectionMode,
      isRowSelected,
      actualRowId,
      isLastFocusedRow,
      isInBody,
    }),
  };
  useRegisterRow(actualRowId, readOnly, disabled, rowData, selectionIds);
  // Only data rows are something to point at; a "select all" header row is a control above them.
  const hoverTarget = useHoverHighlightTarget();

  const rowContextValue = useMemo(() => {
    return {
      rowId: actualRowId,
      data: rowData,
    };
  }, [actualRowId, rowData]);

  const rowElem = (
    <RowInner asChild={asChild} {...(isInBody ? withHoverTarget(hoverTarget, rowProps) : rowProps)}>
      {children}
    </RowInner>
  );

  const contextWrappedElem = <RowContext value={rowContextValue}>{rowElem}</RowContext>;

  const selectionCtxValue = useMemo(() => {
    const representedIds = selectionIds ?? [actualRowId];
    const selectedCount = representedIds.filter((rowId) => selection.has(rowId)).length;
    const selected =
      selectedCount === 0
        ? false
        : selectedCount === representedIds.length
          ? true
          : "indeterminate";
    return {
      selected: selected as boolean | "indeterminate",
      onCheckedChange: (checked: boolean, event?: MouseEvent<HTMLButtonElement>) => {
        if (disabled || (readOnly && selectionIds === undefined)) return;

        const dataRows = rowsStore.getSnapshot().rows;
        const selectedRows = selectedRowsAmong(selection, dataRows);
        const anchor = focusStore.getSnapshot().lastSelectionAnchorId;
        if (event?.shiftKey && selectionMode === "multiple" && anchor) {
          const orderedRowIds = Array.from(
            containerRef?.current?.querySelectorAll<HTMLElement>("[data-row-id]") ?? [],
            (row) => row.dataset["rowId"] ?? "",
          ).filter(Boolean);
          const range = selectionIdsInRange(dataRows, anchor, actualRowId, orderedRowIds);
          if (range.length) {
            selectionDispatch({
              type: "setSelectedRows",
              selectedRows: [...selectedRows, ...range],
            });
            return;
          }
        }

        if (selectionMode === "single") {
          selectionDispatch({
            type: "setSelectedRows",
            selectedRows: checked ? representedIds.slice(0, 1) : [],
          });
        } else {
          const next = new Set(selectedRows);
          for (const rowId of representedIds) {
            if (checked) next.add(rowId);
            else next.delete(rowId);
          }
          selectionDispatch({ type: "setSelectedRows", selectedRows: [...next] });
        }
        dispatch({ type: "setLastSelectionAnchor", rowId: actualRowId });
      },
    };
  }, [
    selectionDispatch,
    dispatch,
    focusStore,
    rowsStore,
    actualRowId,
    disabled,
    readOnly,
    selectionIds,
    selectionMode,
    selection,
    containerRef,
  ]);

  // Only provide SelectionIndicatorContext for rows inside GridListBody
  if (selectionMode === "none" || !isInBody) {
    return contextWrappedElem;
  }

  return (
    <SelectionIndicatorContext value={selectionCtxValue}>
      {contextWrappedElem}
    </SelectionIndicatorContext>
  );
};

function RowInner({
  children,
  asChild,
  ...divProps
}: {
  children: React.ReactNode;
  asChild?: boolean | undefined;
} & React.HTMLAttributes<HTMLDivElement>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dispatch = useGridListDispatch();
  const { rowId } = use(RowContext);
  useHandleSpacebar(rowRef);

  const rowProps: React.HTMLAttributes<HTMLDivElement> = {
    ...divProps,
    onFocusCapture: (event) => {
      const origin = event.relatedTarget as Element;

      const isEnteringRow = !origin || !rowRef.current?.contains(origin);

      divProps.onFocusCapture?.(event);
      if (isEnteringRow) {
        // set lastFocusedRowId to the rowId
        dispatch({ type: "setLastFocusedRow", rowId: rowId });
      }
    },
  };

  const rowElem = asChild ? (
    <Slot ref={rowRef} {...rowProps}>
      {children}
    </Slot>
  ) : (
    <div ref={rowRef} {...rowProps}>
      {children}
    </div>
  );

  return rowElem;
}

export function GridListItemIndicatorRoot({
  children,
  className,
  selectLabel = "Select",
  deselectLabel = "Deselect",
  onCheckedChange: onChange,
  ...buttonProps
}: {
  children?: React.ReactNode;
  selectLabel?: string | undefined;
  deselectLabel?: string | undefined;
  onCheckedChange?: (checked: boolean) => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { selected, onCheckedChange } = useContext(SelectionIndicatorContext);
  const label = selected ? deselectLabel : selectLabel;
  return (
    <button
      {...buttonProps}
      type="button"
      role="checkbox"
      aria-checked={selected === "indeterminate" ? "mixed" : selected}
      aria-label={buttonProps["aria-label"] ?? label}
      data-slot="grid-list-check"
      className={className}
      onClick={(event) => {
        buttonProps.onClick?.(event);
        if (event.defaultPrevented) return;
        const next = selected !== true;
        onCheckedChange(next, event);
        onChange?.(next);
      }}
    >
      {children ??
        (selected === "indeterminate" ? <IndicatorIcon path="M3 8h10" /> : selected ? <IndicatorIcon path="M3 8.5l3.5 3.5L13 4.5" /> : null)}
    </button>
  );
}

/** The check and dash a selection indicator shows when given no children of its own. */
function IndicatorIcon({ path }: { path: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={path} />
    </svg>
  );
}

function IndicatorState({
  children,
  when,
}: {
  children: React.ReactNode;
  when: "selected" | "unselected" | "indeterminate";
}) {
  const { selected } = useContext(SelectionIndicatorContext);
  const isIndeterminate = selected === "indeterminate";

  const shouldShow =
    (when === "selected" && selected && !isIndeterminate) ||
    (when === "unselected" && !selected && !isIndeterminate) ||
    (when === "indeterminate" && selected === "indeterminate");

  if (!shouldShow) {
    return null;
  }

  return <>{children}</>;
}

export function GridListItemSelectedIndicator({ children }: { children: React.ReactNode }) {
  return <IndicatorState when="selected">{children}</IndicatorState>;
}

export function GridListItemUnselectedIndicator({ children }: { children: React.ReactNode }) {
  return <IndicatorState when="unselected">{children}</IndicatorState>;
}

export function GridListItemIndeterminateIndicator({ children }: { children: React.ReactNode }) {
  return <IndicatorState when="indeterminate">{children}</IndicatorState>;
}

export function GridListColumnHeader({
  children,
  className,
  sortable = false,
  sortDirection = "none",
  onSort,
  colSpan,
  asChild,
  ...divProps
}: GridListColumnHeaderProps) {
  const handleSort = useCallback(() => {
    if (sortable && onSort) {
      onSort();
    }
  }, [sortable, onSort]);

  const headerProps: React.HTMLAttributes<HTMLDivElement> & {
    "data-slot": string;
    "aria-sort"?: "ascending" | "descending" | "none" | undefined;
    "aria-colspan"?: number | undefined;
    "data-sortable"?: string | undefined;
    "data-sort-direction"?: string | undefined;
  } = {
    "data-slot": "grid-list-columnheader",
    ...divProps,
    role: "columnheader",
    className,
    tabIndex: sortable ? 0 : undefined,
    onClick: sortable ? handleSort : divProps.onClick,
    onKeyDown: sortable
      ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSort();
          }
          divProps.onKeyDown?.(event);
        }
      : divProps.onKeyDown,
    "aria-sort": sortable ? sortDirection : undefined,
    "data-sortable": sortable ? "true" : undefined,
    "data-sort-direction": sortDirection !== "none" ? sortDirection : undefined,
  };

  // Add colspan if specified
  if (colSpan && colSpan > 1) {
    headerProps["aria-colspan"] = colSpan;
  }

  if (asChild) {
    return <Slot {...headerProps}>{children}</Slot>;
  }

  return <div {...headerProps}>{children}</div>;
}

export function GridListRowHeader({
  children,
  className,
  rowSpan,
  scope = "row",
  asChild,
  ...divProps
}: GridListRowHeaderProps) {
  const rowContext = useContext(RowContext);
  const selectionDispatch = useSelectionDispatch();
  const { selectionMode } = useSelectionState();
  const selection = useHeldSelection();
  const rowsStore = useGridRowsStore();

  const headerProps: React.HTMLAttributes<HTMLDivElement> & {
    "data-slot": string;
    "aria-rowspan"?: number | undefined;
    scope?: "row" | "rowgroup";
  } = {
    ...divProps,
    "data-slot": "grid-list-rowheader",
    role: "rowheader",
    scope,
    className,
    onDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => {
      try {
        // Only handle double-click if we have a row context and selection is enabled
        if (!rowContext || selectionMode === "none") return;

        const { rowId } = rowContext;
        const { rows } = rowsStore.getSnapshot();

        // Find the row data to check if it's disabled or readOnly
        const rowData = rows.find((row) => row.rowId === rowId);
        if (rowData?.disabled || rowData?.readOnly) return;

        // Toggle selection state
        const isCurrentlySelected = selectedRowsAmong(selection, rows).has(rowId);
        if (isCurrentlySelected) {
          selectionDispatch({ type: "deselectRow", rowId });
        } else {
          selectionDispatch({ type: "selectRow", rowId });
        }
      } finally {
        // Call the original onDoubleClick if provided
        divProps.onDoubleClick?.(event);
      }
    },
  };

  // Add rowspan if specified
  if (rowSpan && rowSpan > 1) {
    headerProps["aria-rowspan"] = rowSpan;
  }

  if (asChild) {
    return <Slot {...headerProps}>{children}</Slot>;
  }

  return <div {...headerProps}>{children}</div>;
}

export function GridListCell({ children, className, asChild, ...divProps }: GridListCellProps) {
  const cellProps: React.HTMLAttributes<HTMLDivElement> & { "data-slot": string } = {
    "data-slot": "grid-list-cell",
    ...divProps,
    className,
    role: "gridcell",
  };

  if (asChild) {
    return <Slot {...cellProps}>{children}</Slot>;
  }

  return <div {...cellProps}>{children}</div>;
}

export function GridCurrentFocusFormField({ name }: { name: string }) {
  const lastFocusedRowId = useGridFocus((state) => state.lastFocusedRowId);

  if (!lastFocusedRowId) {
    return null;
  }

  return <input type="hidden" name={name} value={lastFocusedRowId} />;
}

export function GridCurrentSelectedRowsFormField({ name }: { name: string }) {
  const selectedRows = useSelectedRows();

  return (
    <select name={name} hidden multiple value={Array.from(selectedRows)} onChange={() => {}}>
      {Array.from(selectedRows).map((rowId) => (
        <option key={rowId} value={rowId}>
          {rowId}
        </option>
      ))}
    </select>
  );
}

export function CurrentRowIdFormField({ name }: { name: string }) {
  const rowContext = useContext(RowContext);

  if (!rowContext) {
    throw new Error("CurrentRowIdFormField must be used within a GridListRow");
  }

  const { rowId } = rowContext;

  return <input type="hidden" name={name} value={rowId} />;
}

function gridRowAttributes({
  readOnly,
  disabled,
  selectionMode,
  isRowSelected,
  actualRowId,
  isLastFocusedRow,
  isInBody,
}: {
  readOnly: boolean | undefined;
  disabled: boolean | undefined;
  selectionMode: SelectionState["selectionMode"];
  isRowSelected: boolean;
  actualRowId: string;
  isLastFocusedRow: boolean;
  isInBody: boolean;
}) {
  return {
    "aria-readonly": readOnly || undefined,
    "aria-disabled": disabled || undefined,
    "aria-selected": selectionMode === "none" ? undefined : isRowSelected,

    "data-row-id": actualRowId,
    "data-restore-focus": isLastFocusedRow ? "true" : undefined,
    "data-selected": isRowSelected ? "true" : undefined,
    "data-readonly": readOnly ? "true" : undefined,
    "data-disabled": disabled ? "true" : undefined,
    // A row outside GridBody (a "select all" header) is a stop in the arrow-key order, but not the
    // grid's default tab stop and not where Home/End land — those mean the data rows.
    "data-header-row": isInBody ? undefined : "true",
  };
}

"use client";

import { createContext, useContext, useSyncExternalStore, type MouseEvent } from "react";
import { createReducerContext } from "./reducer-context.js";
import { createGridStore, detachedGridStore, type GridStore } from "./store.js";
import type {
  GridDataState,
  GridDataAction,
  SelectionState,
  SelectionAction,
  GridFocusState,
  GridListConfig,
  GridAction,
  GridLabelingState,
  GridLabelingAction,
} from "./types.js";

const defaultGridDataState: GridDataState = {
  rows: [],
};

const defaultSelectionState: SelectionState = {
  selectionMode: "none",
  selectedRows: new Set(),
};

const initialGridFocusState: GridFocusState = {
  lastFocusedRowId: null,
  lastSelectionAnchorId: null,
  isFocusWithinContainer: false,
};

const defaultGridListConfig: GridListConfig = {
  cycleRowFocus: false,
  name: undefined,
  required: false,
  _default: true,
};

const defaultGridLabelingState: GridLabelingState = {
  labelIds: [],
  captionIds: [],
};

function gridDataReducer(state: GridDataState, action: GridDataAction): GridDataState {
  switch (action.type) {
    case "addRow":
      // check for existence before adding
      if (state.rows.some((row) => row.rowId === action.rowId)) {
        return state;
      }
      return {
        ...state,
        rows: [
          ...state.rows,
          {
            rowId: action.rowId,
            readOnly: action.readOnly,
            disabled: action.disabled,
            data: action.data,
            selectionIds: action.selectionIds,
          },
        ],
      };
    case "removeRow": {
      const newRows = state.rows.filter((row) => row.rowId !== action.rowId);
      return {
        ...state,
        rows: newRows,
      };
    }
    case "updateRow": {
      const newRows = state.rows.map((row) =>
        row.rowId === action.rowId
          ? {
              ...row,
              readOnly: action.readOnly,
              disabled: action.disabled,
              data: action.data,
              selectionIds: action.selectionIds,
            }
          : row,
      );
      return {
        ...state,
        rows: newRows,
      };
    }
  }
  return state;
}

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "selectRow": {
      const newSelectedRows = new Set(state.selectedRows);
      if (state.selectionMode === "single") {
        newSelectedRows.clear();
      }
      newSelectedRows.add(action.rowId);
      return {
        ...state,
        selectedRows: newSelectedRows,
      };
    }
    case "deselectRow": {
      const newSelectedRows = new Set(state.selectedRows);
      newSelectedRows.delete(action.rowId);
      return {
        ...state,
        selectedRows: newSelectedRows,
      };
    }

    case "toggleRowSelection": {
      const newSelectedRows = new Set(state.selectedRows);
      if (newSelectedRows.has(action.rowId)) {
        newSelectedRows.delete(action.rowId);
      } else {
        if (state.selectionMode === "single") {
          newSelectedRows.clear();
        }
        newSelectedRows.add(action.rowId);
      }
      return {
        ...state,
        selectedRows: newSelectedRows,
      };
    }

    case "clearSelection": {
      // Preserve read-only rows that are currently selected
      if (!action.rows) {
        return {
          ...state,
          selectedRows: new Set(),
        };
      }

      const readOnlyRowIds = action.rows.filter((row) => row.readOnly).map((row) => row.rowId);

      const preservedReadOnlySelections = readOnlyRowIds.filter((rowId) =>
        state.selectedRows.has(rowId),
      );

      return {
        ...state,
        selectedRows: new Set(preservedReadOnlySelections),
      };
    }

    case "selectAllRows": {
      // Start with the selectable rows, composite rows expanded into their members
      const newSelectedRows = new Set(selectableRowIds(action.allRows));

      // Get read-only rows and preserve their previous selections
      const readOnlyRowIds = action.allRows.filter((row) => row.readOnly).map((row) => row.rowId);

      // Add back any read-only rows that were previously selected
      for (const rowId of readOnlyRowIds) {
        if (state.selectedRows.has(rowId)) {
          newSelectedRows.add(rowId);
        }
      }

      return {
        ...state,
        selectedRows: newSelectedRows,
      };
    }

    case "setSelectedRows": {
      return {
        ...state,
        selectedRows: new Set(action.selectedRows),
      };
    }
  }

  return state;
}

/**
 * Every selectable data-row ID: rows that are neither disabled nor read-only, plus the members of
 * composite rows. A collapsed pile has not mounted its members, so they are only reachable through
 * the pile's `selectionIds`; a member that has registered as read-only or disabled stays out.
 */
export function selectableRowIds(rows: GridDataState["rows"]): string[] {
  const locked = new Set(
    rows.filter((row) => row.disabled || row.readOnly).map((row) => row.rowId),
  );
  const ids = rows.flatMap((row) => {
    if (row.disabled) return [];
    if (row.selectionIds !== undefined) return row.selectionIds.filter((id) => !locked.has(id));
    return row.readOnly ? [] : [row.rowId];
  });
  return [...new Set(ids)];
}

/** Selectable data rows between two visual rows, expanding composite rows into their members. */
export function selectionIdsInRange(
  rows: GridDataState["rows"],
  fromRowId: string,
  toRowId: string,
  orderedRowIds: readonly string[] = rows.map((row) => row.rowId),
): string[] {
  const from = orderedRowIds.indexOf(fromRowId);
  const to = orderedRowIds.indexOf(toRowId);
  if (from === -1 || to === -1) return [];

  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const rowsById = new Map(rows.map((row) => [row.rowId, row]));
  return orderedRowIds.slice(start, end + 1).flatMap((rowId) => {
    const row = rowsById.get(rowId);
    if (!row) return [];
    if (row.disabled) return [];
    if (row.selectionIds !== undefined) return [...row.selectionIds];
    return row.readOnly ? [] : [row.rowId];
  });
}

function gridLabelingReducer(
  state: GridLabelingState,
  action: GridLabelingAction,
): GridLabelingState {
  switch (action.type) {
    case "addLabel":
      if (state.labelIds.includes(action.id)) {
        return state;
      }
      return {
        ...state,
        labelIds: [...state.labelIds, action.id],
      };
    case "removeLabel":
      return {
        ...state,
        labelIds: state.labelIds.filter((id) => id !== action.id),
      };
    case "addCaption":
      if (state.captionIds.includes(action.id)) {
        return state;
      }
      return {
        ...state,
        captionIds: [...state.captionIds, action.id],
      };
    case "removeCaption":
      return {
        ...state,
        captionIds: state.captionIds.filter((id) => id !== action.id),
      };
    default:
      return state;
  }
}

// Selection State Provider. Selection changes only when someone selects, so it can stay a context.
export const [SelectionStateProvider, useSelectionState, useSelectionDispatch] =
  createReducerContext(selectionReducer, defaultSelectionState);

export function gridFocusReducer(state: GridFocusState, action: GridAction): GridFocusState {
  switch (action.type) {
    case "setLastFocusedRow":
      if (state.lastFocusedRowId === action.rowId) return state;
      return { ...state, lastFocusedRowId: action.rowId };
    case "setFocusWithinContainer":
      if (state.isFocusWithinContainer === action.isFocusWithinContainer) {
        return state;
      }
      return { ...state, isFocusWithinContainer: action.isFocusWithinContainer };
    case "setLastSelectionAnchor":
      if (state.lastSelectionAnchorId === action.rowId) return state;
      return { ...state, lastSelectionAnchorId: action.rowId };
  }
}

/**
 * The grid state that changes while its rows hydrate — rows registering as they hydrate, focus moving,
 * a title registering — kept in stores rather than context values: see `createGridStore`.
 */
type GridStores = {
  rows: GridStore<GridDataState, GridDataAction>;
  focus: GridStore<GridFocusState, GridAction>;
  labeling: GridStore<GridLabelingState, GridLabelingAction>;
};

export function createGridStores(): GridStores {
  return {
    rows: createGridStore(gridDataReducer, defaultGridDataState),
    focus: createGridStore(gridFocusReducer, initialGridFocusState),
    labeling: createGridStore(gridLabelingReducer, defaultGridLabelingState),
  };
}

/** Outside a container nothing registers and nothing is focused, as the old default contexts read. */
const detachedStores: GridStores = {
  rows: detachedGridStore(defaultGridDataState),
  focus: detachedGridStore(initialGridFocusState),
  labeling: detachedGridStore(defaultGridLabelingState),
};

export const GridStoresContext = createContext<GridStores>(detachedStores);
export const GridListConfigContext = createContext<GridListConfig>(defaultGridListConfig);

function useStoreState<State, Action, T>(
  store: GridStore<State, Action>,
  select: (state: State) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getInitialSnapshot()),
  );
}

const whole = <State>(state: State) => state;

export function useGridListConfig(): GridListConfig {
  return useContext(GridListConfigContext);
}

/**
 * Every registered row. Re-renders on each registration, so a row must never call it: rows read
 * `useGridRowsStore().getSnapshot()` when an event needs the list.
 */
export function useGridDataState(): GridDataState {
  return useStoreState(useContext(GridStoresContext).rows, whole);
}

export function useGridDataDispatch(): GridStores["rows"]["dispatch"] {
  return useContext(GridStoresContext).rows.dispatch;
}

/** The row registry, for handlers that read it when they run rather than when they render. */
export function useGridRowsStore(): GridStores["rows"] {
  return useContext(GridStoresContext).rows;
}

/** Subscribes to one fact about focus; `select` must return a primitive or a stored value. */
export function useGridFocus<T>(select: (state: GridFocusState) => T): T {
  return useStoreState(useContext(GridStoresContext).focus, select);
}

/** The focus store, for handlers that read focus when they run rather than when they render. */
export function useGridFocusStore(): GridStores["focus"] {
  return useContext(GridStoresContext).focus;
}

export function useGridListDispatch(): GridStores["focus"]["dispatch"] {
  return useContext(GridStoresContext).focus.dispatch;
}

export function useGridLabelingState(): GridLabelingState {
  return useStoreState(useContext(GridStoresContext).labeling, whole);
}

export function useGridLabelingDispatch(): GridStores["labeling"]["dispatch"] {
  return useContext(GridStoresContext).labeling.dispatch;
}

export const ControlledValueContext = createContext<Set<string> | null>(null);

export const RowContext = createContext<{
  rowId: string;
  data?: unknown;
}>({
  rowId: "",
});

export const GridListBodyContext = createContext<boolean>(false);

export const SelectionIndicatorContext = createContext<{
  selected: boolean | "indeterminate";
  onCheckedChange: (checked: boolean, event?: MouseEvent<HTMLButtonElement>) => void;
}>({
  selected: false,
  onCheckedChange: () => {},
});

/** The selected IDs that belong to a registered row (or a composite row's members). */
export function selectedRowsAmong(
  selected: ReadonlySet<string>,
  rows: GridDataState["rows"],
): Set<string> {
  const validRowIds = new Set(rows.flatMap((row) => [row.rowId, ...(row.selectionIds ?? [])]));
  return new Set(Array.from(selected).filter((rowId) => validRowIds.has(rowId)));
}

/**
 * The selection as held, controlled or not, without dropping IDs whose rows have gone. A row reads
 * this: whether its own IDs are selected does not depend on which other rows have registered, and
 * reading the registry would re-render every row each time another one hydrates.
 */
export function useHeldSelection(): ReadonlySet<string> {
  const controlledValue = useContext(ControlledValueContext);
  const { selectedRows } = useSelectionState();
  return controlledValue ?? selectedRows;
}

// Internal hook for accessing selected rows
export function useSelectedRows() {
  const selection = useHeldSelection();
  const { rows } = useGridDataState();

  // Filter selected rows to only include those that still exist in the table
  return selectedRowsAmong(selection, rows);
}

export function useSelectedRowsData<T>(): ReadonlyArray<
  GridDataState["rows"][number] & { data: T }
> {
  const selectedRows = useSelectedRows();
  const { rows } = useGridDataState();

  return rows.filter((row) => selectedRows.has(row.rowId)) as ReadonlyArray<
    GridDataState["rows"][number] & { data: T }
  >;
}

export function useFocusedRowData<T>(): T | undefined {
  const lastFocusedRowId = useGridFocus((state) => state.lastFocusedRowId);
  const { rows } = useGridDataState();

  if (lastFocusedRowId == null) {
    return undefined;
  }

  return rows.find((row) => row.rowId === lastFocusedRowId)?.data as T;
}

export const GridContentContext = createContext<{
  containerRef?: React.RefObject<HTMLDivElement | null>;
  _default?: true;
}>({
  _default: true,
});

export const GridAccessibilityContext = createContext<
  Pick<
    React.AriaAttributes,
    "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-readonly"
  >
>({});

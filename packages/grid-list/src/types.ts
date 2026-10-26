import type { FormEventHandler } from "react";

// Grid Data Types - for managing row data
export type GridDataState = {
  rows: Array<{
    rowId: string;
    readOnly?: boolean | undefined;
    disabled?: boolean | undefined;
    data?: unknown;
    /** Data-row IDs represented by a composite row during range selection. */
    selectionIds?: readonly string[] | undefined;
  }>;
};

export type GridDataAction =
  | {
      type: "addRow";
      rowId: string;
      readOnly?: boolean | undefined;
      disabled?: boolean | undefined;
      data?: unknown;
      selectionIds?: readonly string[] | undefined;
    }
  | {
      type: "removeRow";
      rowId: string;
    }
  | {
      type: "updateRow";
      rowId: string;
      readOnly?: boolean | undefined;
      disabled?: boolean | undefined;
      data?: unknown;
      selectionIds?: readonly string[] | undefined;
    };

// Selection State Types - for managing selection
export type SelectionState = {
  selectionMode: "none" | "single" | "multiple";
  selectedRows: Set<string>;
};

export type SelectionAction =
  | {
      type: "selectRow";
      rowId: string;
    }
  | {
      type: "deselectRow";
      rowId: string;
    }
  | {
      type: "toggleRowSelection";
      rowId: string;
    }
  | {
      type: "clearSelection";
      rows?: Array<{
        rowId: string;
        readOnly?: boolean | undefined;
        disabled?: boolean | undefined;
      }>;
    }
  | {
      type: "selectAllRows";
      allRows: GridDataState["rows"];
    }
  | {
      type: "setSelectedRows";
      selectedRows: string[];
    };

/** Where focus is in the grid. It lives in an external store, not in context: see `createGridStore`. */
export type GridFocusState = {
  lastFocusedRowId: string | null;
  /** Checkbox range anchor; kept separately from focus so mouse selection does not move focus. */
  lastSelectionAnchorId: string | null;
  isFocusWithinContainer: boolean;
};

/** A grid's fixed settings, from `GridListContainer`'s props. */
export type GridListConfig = {
  cycleRowFocus: boolean;
  name?: string | undefined;
  required?: boolean | undefined;
  _default?: boolean | undefined;
};

export type GridAction =
  | {
      type: "setLastFocusedRow";
      rowId: string | null;
    }
  | {
      type: "setFocusWithinContainer";
      isFocusWithinContainer: boolean;
    }
  | {
      type: "setLastSelectionAnchor";
      rowId: string | null;
    };

// Grid Labeling State Types - for managing ARIA labels and descriptions
export type GridLabelingState = {
  labelIds: string[];
  captionIds: string[];
};

export type GridLabelingAction =
  | {
      type: "addLabel";
      id: string;
    }
  | {
      type: "removeLabel";
      id: string;
    }
  | {
      type: "addCaption";
      id: string;
    }
  | {
      type: "removeCaption";
      id: string;
    };

export type ValueOnChangeMode =
  | {
      selectionMode: "multiple";
      initialValue?: string[];
      value?: string[];
      onValueChange?: (value: string[]) => void;
    }
  | {
      selectionMode: "single";
      initialValue?: string | undefined;
      value?: string | undefined;
      onValueChange?: (value: string) => void;
    }
  | {
      selectionMode?: "none";
      initialValue?: undefined;
      value?: undefined;
      onValueChange?: undefined;
    };

export type GridListContentProps = {
  children: React.ReactNode;
  gridClassName?: string | undefined;
  scrollableContainerClassName?: string | undefined;
  scrollable?: boolean | undefined;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className">;

export type GridListRootProps = {
  children: React.ReactNode;
  cycleRowFocus?: boolean | undefined;
  selectionMode?: "none" | "single" | "multiple";
  name?: string | undefined;
  required?: boolean | undefined;
  onInvalid?: FormEventHandler<HTMLSelectElement> | undefined;
  // WAI-ARIA labeling props for grid accessibility
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
} & React.HTMLAttributes<HTMLDivElement> &
  ValueOnChangeMode;

export type GridListRowProps = {
  children: React.ReactNode;
  asChild?: boolean | undefined;
  rowId?: string | undefined;
  readOnly?: boolean | undefined;
  disabled?: boolean | undefined;
  rowData?: unknown;
  /** Data-row IDs represented by a composite row, such as a pile that collapses several rows into one. */
  selectionIds?: readonly string[] | undefined;
} & React.HTMLAttributes<HTMLDivElement>;

export type GridListColumnHeaderProps = {
  children: React.ReactNode;
  sortable?: boolean | undefined;
  sortDirection?: "ascending" | "descending" | "none";
  onSort?: () => void;
  colSpan?: number;
  asChild?: boolean | undefined;
} & React.HTMLAttributes<HTMLDivElement>;

export type GridListRowHeaderProps = {
  children: React.ReactNode;
  rowSpan?: number;
  asChild?: boolean | undefined;
  scope?: "row" | "rowgroup";
} & React.HTMLAttributes<HTMLDivElement>;

export type GridListTitleProps = {
  children: React.ReactNode;
  asChild?: boolean | undefined;
} & React.HTMLAttributes<HTMLHeadingElement>;

export type GridListCaptionProps = {
  children: React.ReactNode;
  asChild?: boolean | undefined;
} & React.HTMLAttributes<HTMLParagraphElement>;

export type GridListCellProps = {
  children: React.ReactNode;
  asChild?: boolean | undefined;
} & React.HTMLAttributes<HTMLDivElement>;

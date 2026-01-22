// /ui/src/lib/types/table.ts
export type TableRowLink = {
  href: string;
  label: string;
};

export type TableSortField<
  FieldKey extends string,
  Extra extends Record<string, unknown> = Record<string, never>
> = {
  field: FieldKey;
  label: string;
} & Extra;

export type TableRowActionLink<T> = {
  key: string;
  title: string;
  icon: string;
  variant?: string;
  type: 'link';
  href: (item: T) => string;
};

export type TableRowActionButton<T> = {
  key: string;
  title: string;
  icon: string;
  variant?: string;
  type: 'button';
  handler: (item: T) => void;
};

export type TableRowAction<T> = TableRowActionLink<T> | TableRowActionButton<T>;

export type TableAffordances<
  T,
  SortField extends TableSortField<string, Record<string, unknown>>,
  RowAction extends TableRowAction<T>
> = {
  searchPlaceholder: string;
  rowLink: (item: T) => TableRowLink;
  sortFields: SortField[];
  rowActions: RowAction[];
};

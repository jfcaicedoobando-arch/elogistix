/**
 * `columnBuilders` — helpers tipados para armar `ColumnDef<T>` consistentes
 * en toda la app (estado, cliente, monto, fecha).
 *
 * Para columna de acciones ver `./actionsColumn`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { StatusDomain } from "@/lib/status/statusRegistry";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import { toTitleCase } from "@/lib/formatters/text";
import { cn } from "@/lib/utils";

export { actionsColumn } from "./actionsColumn";
;

type Getter<T, V> = (row: T) => V;

export interface StatusColumnOpts<T> {
  id?: string;
  header?: string;
  domain: StatusDomain;
  accessor: Getter<T, string | null | undefined>;
  showIcon?: boolean;
}

export function statusColumn<T>({
  id = "estado",
  header = "Estado",
  domain,
  accessor,
  showIcon = false,
}: StatusColumnOpts<T>): ColumnDef<T, unknown> {
  return {
    id,
    header,
    accessorFn: (row) => accessor(row) ?? "",
    cell: ({ row }) => (
      <StatusBadge domain={domain} status={accessor(row.original)} showIcon={showIcon} />
    ),
    enableSorting: true,
  };
}

export interface ClientColumnOpts<T> {
  id?: string;
  header?: string;
  accessor: Getter<T, string | null | undefined>;
}

export function clientColumn<T>({
  id = "cliente",
  header = "Cliente",
  accessor,
}: ClientColumnOpts<T>): ColumnDef<T, unknown> {
  return {
    id,
    header,
    accessorFn: (row) => accessor(row) ?? "",
    cell: ({ row }) => (
      <span
        className="block min-w-[220px] whitespace-normal break-words leading-snug"
        title={accessor(row.original) ?? ""}
      >
        {toTitleCase(accessor(row.original) ?? "")}
      </span>
    ),
    enableSorting: true,
  };
}

export interface MoneyColumnOpts<T> {
  id?: string;
  header?: string;
  accessor: Getter<T, number | null | undefined>;
  currencyAccessor?: Getter<T, string | null | undefined>;
  defaultCurrency?: string;
  align?: "left" | "right";
}

export function moneyColumn<T>({
  id = "monto",
  header = "Monto",
  accessor,
  currencyAccessor,
  defaultCurrency = "MXN",
  align = "right",
}: MoneyColumnOpts<T>): ColumnDef<T, unknown> {
  return {
    id,
    header,
    accessorFn: (row) => accessor(row) ?? 0,
    cell: ({ row }) => {
      const amount = accessor(row.original) ?? 0;
      const currency = currencyAccessor?.(row.original) ?? defaultCurrency;
      return (
        <span
          className={cn(
            "tabular-nums whitespace-nowrap",
            align === "right" && "block text-right",
          )}
        >
          {formatCurrency(amount, currency)}
        </span>
      );
    },
    enableSorting: true,
  };
}

export interface DateColumnOpts<T> {
  id?: string;
  header?: string;
  accessor: Getter<T, string | null | undefined>;
  format?: string;
}

export function dateColumn<T>({
  id = "fecha",
  header = "Fecha",
  accessor,
  format = "dd/MM/yyyy",
}: DateColumnOpts<T>): ColumnDef<T, unknown> {
  return {
    id,
    header,
    accessorFn: (row) => accessor(row) ?? "",
    cell: ({ row }) => {
      const raw = accessor(row.original);
      return (
        <span className="tabular-nums whitespace-nowrap">
          {raw ? formatDate(raw, format) : "—"}
        </span>
      );
    },
    enableSorting: true,
  };
}

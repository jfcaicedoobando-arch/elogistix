/**
 * Columnas del DataTable de proyección mensual de facturación (Fase 2 —
 * ColumnDef nativo TanStack).
 */
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { GrupoProyeccion } from "@/lib/domain/proyeccionFacturacion";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";

export const proyeccionColumns: ColumnDef<GrupoProyeccion, unknown>[] = defineColumns<GrupoProyeccion>([
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (g) => g.expediente,
    enableSorting: true,
    sortingFn: sortByString<GrupoProyeccion>((g) => g.expediente),
    meta: { width: "w-[120px]", sticky: true, className: "font-mono font-medium whitespace-nowrap" },
    cell: ({ row }) => row.original.expediente,
  },
  {
    id: "cliente",
    header: "Cliente",
    accessorFn: (g) => g.cliente_nombre,
    enableSorting: true,
    sortingFn: sortByString<GrupoProyeccion>((g) => g.cliente_nombre),
    meta: { width: "min-w-[180px]", className: "max-w-[240px] truncate" },
    cell: ({ row }) => (
      <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>
    ),
  },
  {
    id: "operador",
    header: "Operador",
    accessorFn: (g) => g.operador,
    enableSorting: true,
    sortingFn: sortByString<GrupoProyeccion>((g) => g.operador),
    meta: { width: "w-[140px]", className: "truncate text-sm" },
    cell: ({ row }) => row.original.operador || <span className="text-muted-foreground">—</span>,
  },
  {
    id: "eta",
    header: "ETA",
    accessorFn: (g) => g.eta ?? "",
    enableSorting: true,
    sortingFn: sortByDate<GrupoProyeccion>((g) => g.eta),
    meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
    cell: ({ row }) => (row.original.eta ? formatDate(row.original.eta) : "—"),
  },
  {
    id: "contenedores",
    header: "Cont.",
    meta: { width: "w-[70px]", align: "center" },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 text-xs" title={row.original.contenedores.join(", ")}>
        <Package className="h-3 w-3 opacity-60" />
        <span className="tabular-nums font-medium">{row.original.totalContenedores || 0}</span>
      </span>
    ),
  },
  {
    id: "venta_usd",
    header: "Venta USD",
    accessorFn: (g) => g.ventaUsd,
    enableSorting: true,
    sortingFn: sortByNumber<GrupoProyeccion>((g) => g.ventaUsd),
    meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap" },
    cell: ({ row }) => formatCurrency(row.original.ventaUsd, "USD"),
  },
  {
    id: "venta",
    header: "Venta MXN",
    accessorFn: (g) => g.ventaMxn,
    enableSorting: true,
    sortingFn: sortByNumber<GrupoProyeccion>((g) => g.ventaMxn),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap" },
    cell: ({ row }) => formatCurrency(row.original.ventaMxn, "MXN"),
  },
  {
    id: "costo",
    header: "Costo MXN",
    accessorFn: (g) => g.costoMxn,
    enableSorting: true,
    sortingFn: sortByNumber<GrupoProyeccion>((g) => g.costoMxn),
    meta: { width: "w-[140px]", align: "right", className: "tabular-nums whitespace-nowrap text-muted-foreground" },
    cell: ({ row }) => formatCurrency(row.original.costoMxn, "MXN"),
  },
  {
    id: "profit",
    header: "Profit MXN",
    accessorFn: (g) => g.profitMxn,
    enableSorting: true,
    sortingFn: sortByNumber<GrupoProyeccion>((g) => g.profitMxn),
    meta: { width: "w-[150px]", align: "right", className: "tabular-nums font-medium whitespace-nowrap" },
    cell: ({ row }) => (
      <span className={cn(row.original.profitMxn < 0 ? "text-destructive" : "text-success")}>
        {formatCurrency(row.original.profitMxn, "MXN")}
      </span>
    ),
  },
  {
    id: "margen",
    header: "%",
    accessorFn: (g) => g.margenPct,
    enableSorting: true,
    sortingFn: sortByNumber<GrupoProyeccion>((g) => g.margenPct),
    meta: { width: "w-[70px]", align: "right", className: "tabular-nums text-xs" },
    cell: ({ row }) => {
      const m = row.original.margenPct;
      return (
        <span
          className={cn(
            m < 0 ? "text-destructive" : m < 10 ? "text-warning" : "text-foreground",
          )}
        >
          {m.toFixed(1)}%
        </span>
      );
    },
  },
  {
    id: "estado",
    header: "Estado",
    accessorFn: (g) => g.estado,
    enableSorting: true,
    sortingFn: sortByString<GrupoProyeccion>((g) => g.estado),
    meta: { width: "w-[110px]" },
    cell: ({ row }) =>
      row.original.estado === "Facturado" ? (
        <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
          Facturado
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          Pendiente
        </Badge>
      ),
  },
]);

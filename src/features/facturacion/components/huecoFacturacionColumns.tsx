/**
 * Definición de columnas del DataTable de "Hueco de Facturación"
 * (Fase 2 — ColumnDef nativo TanStack).
 */
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { FilaHueco } from "@/features/facturacion/services";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { getDiasVencidosTone } from "@/lib/ui/uiMappings";
import { cn } from "@/lib/utils";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export const huecoFacturacionColumns: ColumnDef<FilaHueco, unknown>[] = defineColumns<FilaHueco>([
  {
    id: "expediente",
    header: "Expediente",
    accessorFn: (f) => f.expediente,
    enableSorting: true,
    sortingFn: sortByString<FilaHueco>((f) => f.expediente),
    meta: { width: COL_W.folio, sticky: true, className: "font-mono font-medium whitespace-nowrap" },
    cell: ({ row }) => row.original.expediente || "—",
  },
  {
    id: "cliente",
    header: "Cliente",
    accessorFn: (f) => f.cliente_nombre,
    enableSorting: true,
    sortingFn: sortByString<FilaHueco>((f) => f.cliente_nombre),
    meta: { width: COL_W.ruta, className: "max-w-[260px] truncate" },
    cell: ({ row }) => (
      <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>
    ),
  },
  {
    id: "operador",
    header: "Operador",
    accessorFn: (f) => f.operador,
    enableSorting: true,
    sortingFn: sortByString<FilaHueco>((f) => f.operador),
    meta: { width: COL_W.monto, className: "truncate text-sm" },
    cell: ({ row }) => row.original.operador || <span className="text-muted-foreground">—</span>,
  },
  {
    id: "eta",
    header: "ETA",
    accessorFn: (f) => f.eta,
    enableSorting: true,
    sortingFn: sortByDate<FilaHueco>((f) => f.eta),
    meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" },
    cell: ({ row }) => formatDate(row.original.eta),
  },
  {
    id: "bl",
    header: "BL",
    accessorFn: (f) => f.bl_master ?? f.bl_house ?? "",
    enableSorting: true,
    sortingFn: sortByString<FilaHueco>((f) => f.bl_master ?? f.bl_house ?? ""),
    meta: { width: COL_W.nombre, className: "font-mono text-xs whitespace-nowrap" },
    cell: ({ row }) => {
      const m = row.original.bl_master?.trim();
      const h = row.original.bl_house?.trim();
      if (!m && !h) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-col leading-tight">
          {m && <span title={`Master: ${m}`}>{m}</span>}
          {h && (
            <span className="text-muted-foreground" title={`House: ${h}`}>
              H: {h}
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: "dias",
    header: "Días desde ETA",
    accessorFn: (f) => f.diasDesdeEta,
    enableSorting: true,
    sortingFn: sortByNumber<FilaHueco>((f) => f.diasDesdeEta),
    meta: { width: COL_W.monto, align: "center" },
    cell: ({ row }) => {
      const d = row.original.diasDesdeEta;
      // v13.217.0 — Con la ventana ampliada a hoy+3, `d` puede ser negativo
      // (ETA futura). Mostramos "faltan N d" para no confundir con "hace N d".
      const label = d < 0 ? `faltan ${Math.abs(d)} d` : `${d} d`;
      const tone = getDiasVencidosTone(d);
      return (
        <Badge
          variant="outline"
          className={cn(
            "tabular-nums font-semibold",
            tone === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
            tone === "warning" && "bg-warning/10 text-warning border-warning/30",
            tone === "default" && "bg-muted text-foreground",
          )}
        >
          {label}
        </Badge>
      );
    },

  },
  {
    id: "venta_usd",
    header: "Venta USD",
    accessorFn: (f) => f.ventaUsd,
    enableSorting: true,
    sortingFn: sortByNumber<FilaHueco>((f) => f.ventaUsd),
    meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap" },
    cell: ({ row }) => formatCurrency(row.original.ventaUsd, "USD"),
  },
  {
    id: "venta_mxn",
    header: "Venta MXN",
    accessorFn: (f) => f.ventaMxn,
    enableSorting: true,
    sortingFn: sortByNumber<FilaHueco>((f) => f.ventaMxn),
    meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
    cell: ({ row }) => formatCurrency(row.original.ventaMxn, "MXN"),
  },
]);

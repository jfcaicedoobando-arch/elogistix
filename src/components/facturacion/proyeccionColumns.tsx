/**
 * Columnas del DataTable de proyección mensual de facturación.
 */
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/shared/DataTable";
import type { GrupoProyeccion } from "@/lib/domain/proyeccionFacturacion";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export const proyeccionColumns: DataTableColumn<GrupoProyeccion>[] = [
  {
    key: "expediente",
    header: "Expediente",
    width: "w-[120px]",
    sticky: true,
    className: "font-mono font-medium whitespace-nowrap",
    sortable: true,
    sortValue: (g) => g.expediente,
    render: (g) => g.expediente,
  },
  {
    key: "cliente",
    header: "Cliente",
    width: "min-w-[180px]",
    className: "max-w-[240px] truncate",
    sortable: true,
    sortValue: (g) => g.cliente_nombre,
    render: (g) => (
      <span title={toTitleCase(g.cliente_nombre)}>{toTitleCase(g.cliente_nombre)}</span>
    ),
  },
  {
    key: "operador",
    header: "Operador",
    width: "w-[140px]",
    className: "truncate text-sm",
    sortable: true,
    sortValue: (g) => g.operador,
    render: (g) => g.operador || <span className="text-muted-foreground">—</span>,
  },
  {
    key: "eta",
    header: "ETA",
    width: "w-[100px]",
    className: "text-xs whitespace-nowrap",
    sortable: true,
    sortValue: (g) => g.eta ?? "",
    render: (g) => (g.eta ? formatDate(g.eta) : "—"),
  },
  {
    key: "contenedores",
    header: "Cont.",
    width: "w-[70px]",
    align: "center",
    render: (g) => (
      <span className="inline-flex items-center gap-1 text-xs" title={g.contenedores.join(", ")}>
        <Package className="h-3 w-3 opacity-60" />
        <span className="tabular-nums font-medium">{g.totalContenedores || 0}</span>
      </span>
    ),
  },
  {
    key: "venta_usd",
    header: "Venta USD",
    width: "w-[130px]",
    align: "right",
    className: "tabular-nums whitespace-nowrap",
    sortable: true,
    sortValue: (g) => g.ventaUsd,
    render: (g) => formatCurrency(g.ventaUsd, "USD"),
  },
  {
    key: "venta",
    header: "Venta MXN",
    width: "w-[140px]",
    align: "right",
    className: "tabular-nums whitespace-nowrap",
    sortable: true,
    sortValue: (g) => g.ventaMxn,
    render: (g) => formatCurrency(g.ventaMxn, "MXN"),
  },
  {
    key: "costo",
    header: "Costo MXN",
    width: "w-[140px]",
    align: "right",
    className: "tabular-nums whitespace-nowrap text-muted-foreground",
    sortable: true,
    sortValue: (g) => g.costoMxn,
    render: (g) => formatCurrency(g.costoMxn, "MXN"),
  },
  {
    key: "profit",
    header: "Profit MXN",
    width: "w-[150px]",
    align: "right",
    className: "tabular-nums font-medium whitespace-nowrap",
    sortable: true,
    sortValue: (g) => g.profitMxn,
    render: (g) => (
      <span className={cn(g.profitMxn < 0 ? "text-destructive" : "text-success")}>
        {formatCurrency(g.profitMxn, "MXN")}
      </span>
    ),
  },
  {
    key: "margen",
    header: "%",
    width: "w-[70px]",
    align: "right",
    className: "tabular-nums text-xs",
    sortable: true,
    sortValue: (g) => g.margenPct,
    render: (g) => (
      <span
        className={cn(
          g.margenPct < 0
            ? "text-destructive"
            : g.margenPct < 10
              ? "text-warning"
              : "text-foreground",
        )}
      >
        {g.margenPct.toFixed(1)}%
      </span>
    ),
  },
  {
    key: "estado",
    header: "Estado",
    width: "w-[110px]",
    sortable: true,
    sortValue: (g) => g.estado,
    render: (g) =>
      g.estado === "Facturado" ? (
        <Badge className="bg-success/15 text-success border border-success/30 hover:bg-success/20">
          Facturado
        </Badge>
      ) : (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
          Pendiente
        </Badge>
      ),
  },
];

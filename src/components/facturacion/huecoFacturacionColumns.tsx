/**
 * Definición de columnas del DataTable de "Hueco de Facturación".
 * Aislada del componente para mantenerlo enfocado en composición.
 */
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/shared/DataTable";
import type { FilaHueco } from "@/services/facturas";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { getDiasVencidosTone } from "@/lib/ui/uiMappings";
import { cn } from "@/lib/utils";

export const huecoFacturacionColumns: DataTableColumn<FilaHueco>[] = [
  {
    key: "expediente",
    header: "Expediente",
    width: "w-[120px]",
    sticky: true,
    className: "font-mono font-medium whitespace-nowrap",
    sortable: true,
    sortValue: (f) => f.expediente,
    render: (f) => f.expediente || "—",
  },
  {
    key: "cliente",
    header: "Cliente",
    width: "min-w-[180px]",
    className: "max-w-[260px] truncate",
    sortable: true,
    sortValue: (f) => f.cliente_nombre,
    render: (f) => (
      <span title={toTitleCase(f.cliente_nombre)}>{toTitleCase(f.cliente_nombre)}</span>
    ),
  },
  {
    key: "operador",
    header: "Operador",
    width: "w-[140px]",
    className: "truncate text-sm",
    sortable: true,
    sortValue: (f) => f.operador,
    render: (f) => f.operador || <span className="text-muted-foreground">—</span>,
  },
  {
    key: "etd",
    header: "ETD",
    width: "w-[100px]",
    className: "text-xs whitespace-nowrap",
    sortable: true,
    sortValue: (f) => f.etd,
    render: (f) => formatDate(f.etd),
  },
  {
    key: "bl",
    header: "BL",
    width: "w-[160px]",
    className: "font-mono text-xs whitespace-nowrap",
    sortable: true,
    sortValue: (f) => f.bl_master ?? f.bl_house ?? "",
    render: (f) => {
      const m = f.bl_master?.trim();
      const h = f.bl_house?.trim();
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
    key: "dias",
    header: "Días sin facturar",
    width: "w-[140px]",
    align: "center",
    sortable: true,
    sortValue: (f) => f.diasDesdeEtd,
    render: (f) => {
      const d = f.diasDesdeEtd;
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
          {d} días
        </Badge>
      );
    },
  },
  {
    key: "venta_usd",
    header: "Venta USD",
    width: "w-[130px]",
    align: "right",
    className: "tabular-nums whitespace-nowrap",
    sortable: true,
    sortValue: (f) => f.ventaUsd,
    render: (f) => formatCurrency(f.ventaUsd, "USD"),
  },
  {
    key: "venta_mxn",
    header: "Venta MXN",
    width: "w-[140px]",
    align: "right",
    className: "tabular-nums whitespace-nowrap font-medium",
    sortable: true,
    sortValue: (f) => f.ventaMxn,
    render: (f) => formatCurrency(f.ventaMxn, "MXN"),
  },
];

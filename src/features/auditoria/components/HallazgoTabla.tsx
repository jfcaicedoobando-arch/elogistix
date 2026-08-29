import { ExternalLink, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { HallazgoAuditoria, ReglaAuditoria, SeveridadAuditoria } from "@/features/auditoria/types";
import { cn } from "@/lib/utils";
import { HallazgoDetalleCell } from "./HallazgoDetalleCell";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Hint } from "@/components/shared/Hint";

const reglaToTab: Record<ReglaAuditoria, string> = {
  docs_faltantes: "documentos",
  docs_pendientes_avanzado: "documentos",
  fechas: "tracking",
  ventas_sin_facturar: "facturacion",
  margen_negativo: "financiero",
  margen_bajo: "financiero",
  venta_sin_costo: "financiero",
  costo_sin_venta: "financiero",
  costos_repetidos: "financiero",
  proforma_vencida: "facturacion",
  proforma_borrador_abandonada: "facturacion",
  proforma_inconsistente: "facturacion",
  embarque_huerfano: "tracking",
  factura_sin_timbrar: "facturacion",
  rep_pendiente: "facturacion",
  factura_cancelada_sin_sustitucion: "facturacion",
  cxc_vencida: "facturacion",
  cxp_por_capturar_estancada: "facturacion",
  cxp_vencida: "facturacion",
  contenedor_datos_incompletos: "resumen",
  contenedor_fechas_incompletas: "resumen",
  tipo_cambio_faltante: "financiero",
  venta_total_descuadrado: "financiero",
};

interface Props {
  hallazgos: HallazgoAuditoria[];
}

const severidadConfig: Record<SeveridadAuditoria, { label: string; className: string }> = {
  critico: { label: "Crítico", className: "bg-destructive/15 text-destructive border-destructive/30" },
  alto: { label: "Alto", className: "bg-warning/10 text-warning border-warning/30" },
  medio: { label: "Medio", className: "bg-primary/15 text-primary border-primary/30" },
};

function formatEta(eta: string | null): string {
  if (!eta) return "—";
  const [y, m, d] = eta.split("-");
  return `${d}/${m}/${y}`;
}

export function HallazgoTabla({ hallazgos }: Props) {
  const cols: ColumnDef<HallazgoAuditoria, unknown>[] = defineColumns<HallazgoAuditoria>([
    { id: "sev", header: "Severidad", meta: { width: COL_W.fecha },
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("text-label", severidadConfig[row.original.severidad].className)}>
          {severidadConfig[row.original.severidad].label}
        </Badge>
      ) },
    { id: "exp", header: "Expediente", meta: { width: COL_W.monto, className: "font-medium tabular-nums" }, cell: ({ row }) => row.original.expediente },
    { id: "cliente", header: "Cliente", meta: { className: "truncate max-w-[200px]" },
      cell: ({ row }) => (
        <Hint label={row.original.cliente_nombre}>
          <span>{row.original.cliente_nombre || "—"}</span>
        </Hint>
      ) },
    { id: "estado", header: "Estado", meta: { width: COL_W.fecha, className: "text-body-sm text-muted-foreground" }, cell: ({ row }) => row.original.estado },
    { id: "eta", header: "ETA", meta: { width: COL_W.fecha, className: "text-body-sm tabular-nums text-muted-foreground" }, cell: ({ row }) => formatEta(row.original.eta) },
    { id: "detalle", header: "Detalle", meta: { className: "text-body" },
      cell: ({ row }) => {
        return <HallazgoDetalleCell hallazgo={row.original} />;
      } },
    { id: "acc", header: "", meta: { width: COL_W.short },
      cell: ({ row }) => {
        const h = row.original;
        const url = `${window.location.origin}/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`;
        return (
          <Hint label={`Abrir embarque ${h.expediente} en nueva pestaña`}>
            <Button
              size="sm" variant="ghost" className="h-7 gap-1 text-body-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(url, "_blank", "noopener,noreferrer");
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`Abrir embarque ${h.expediente} en nueva pestaña`}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir
            </Button>
          </Hint>
        );
      } },
  ]);

  if (hallazgos.length === 0) {
    return <EmptyStateInline icon={ShieldCheck} message="Sin hallazgos en esta categoría." />;
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <DataTable
        columns={cols}
        data={hallazgos}
        rowKey={(h) => `${h.embarque_id}-${h.regla}`}
        density={TABLE_DENSITY.embebida}
      />
    </div>
  );
}

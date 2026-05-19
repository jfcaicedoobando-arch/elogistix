import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { HallazgoAuditoria, ReglaAuditoria, SeveridadAuditoria } from "@/types/auditoria";
import { cn } from "@/lib/utils";

const reglaToTab: Record<ReglaAuditoria, string> = {
  docs_faltantes: "documentos",
  docs_pendientes_avanzado: "documentos",
  fechas: "tracking",
  ventas_sin_facturar: "facturacion",
  margen_negativo: "financiero",
  margen_bajo: "financiero",
  venta_sin_costo: "financiero",
  costo_sin_venta: "financiero",
  proforma_vencida: "facturacion",
  embarque_huerfano: "tracking",
};

interface Props {
  hallazgos: HallazgoAuditoria[];
}

const severidadConfig: Record<SeveridadAuditoria, { label: string; className: string }> = {
  critico: { label: "Crítico", className: "bg-destructive/15 text-destructive border-destructive/30" },
  alto: { label: "Alto", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  medio: { label: "Medio", className: "bg-primary/15 text-primary border-primary/30" },
};

function formatEta(eta: string | null): string {
  if (!eta) return "—";
  const [y, m, d] = eta.split("-");
  return `${d}/${m}/${y}`;
}

export function HallazgoTabla({ hallazgos }: Props) {
  const navigate = useNavigate();

  const cols: ColumnDef<HallazgoAuditoria, unknown>[] = defineColumns<HallazgoAuditoria>([
    { id: "sev", header: "Severidad", meta: { width: "w-[110px]" },
      cell: ({ row }) => (
        <Badge variant="outline" className={cn("text-[10px]", severidadConfig[row.original.severidad].className)}>
          {severidadConfig[row.original.severidad].label}
        </Badge>
      ) },
    { id: "exp", header: "Expediente", meta: { width: "w-[140px]", className: "font-medium tabular-nums" }, cell: ({ row }) => row.original.expediente },
    { id: "cliente", header: "Cliente", meta: { className: "truncate max-w-[200px]" },
      cell: ({ row }) => <span title={row.original.cliente_nombre}>{row.original.cliente_nombre || "—"}</span> },
    { id: "estado", header: "Estado", meta: { width: "w-[110px]", className: "text-xs text-muted-foreground" }, cell: ({ row }) => row.original.estado },
    { id: "eta", header: "ETA", meta: { width: "w-[110px]", className: "text-xs tabular-nums text-muted-foreground" }, cell: ({ row }) => formatEta(row.original.eta) },
    { id: "detalle", header: "Detalle", meta: { className: "text-sm" },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <>
            <div>{h.detalle}</div>
            {h.documentos_faltantes && h.documentos_faltantes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {h.documentos_faltantes.map((doc) => (
                  <Badge key={doc} variant="secondary" className="text-[10px] font-normal">{doc}</Badge>
                ))}
              </div>
            )}
          </>
        );
      } },
    { id: "acc", header: "", meta: { width: "w-[90px]" },
      cell: ({ row }) => {
        const h = row.original;
        return (
          <Button
            size="sm" variant="ghost" className="h-7 gap-1 text-xs"
            onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`); }}
            aria-label={`Abrir embarque ${h.expediente}`}
            title={`Abrir embarque ${h.expediente}`}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir
          </Button>
        );
      } },
  ]);

  if (hallazgos.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Sin hallazgos en esta categoría.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <DataTable
        columns={cols}
        data={hallazgos}
        rowKey={(h) => `${h.embarque_id}-${h.regla}`}
        density="compact"
      />
    </div>
  );
}

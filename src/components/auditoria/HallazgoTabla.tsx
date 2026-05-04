import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
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

  const cols: DataTableColumn<HallazgoAuditoria>[] = [
    { key: "sev", header: "Severidad", width: "w-[110px]",
      render: (h) => (
        <Badge variant="outline" className={cn("text-[10px]", severidadConfig[h.severidad].className)}>
          {severidadConfig[h.severidad].label}
        </Badge>
      ) },
    { key: "exp", header: "Expediente", width: "w-[140px]", className: "font-medium tabular-nums", render: (h) => h.expediente },
    { key: "cliente", header: "Cliente", className: "truncate max-w-[200px]",
      render: (h) => <span title={h.cliente_nombre}>{h.cliente_nombre || "—"}</span> },
    { key: "estado", header: "Estado", width: "w-[110px]", className: "text-xs text-muted-foreground", render: (h) => h.estado },
    { key: "eta", header: "ETA", width: "w-[110px]", className: "text-xs tabular-nums text-muted-foreground", render: (h) => formatEta(h.eta) },
    { key: "detalle", header: "Detalle", className: "text-sm",
      render: (h) => (
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
      ) },
    { key: "acc", header: "", width: "w-[90px]",
      render: (h) => (
        <Button
          size="sm" variant="ghost" className="h-7 gap-1 text-xs"
          onClick={(e) => { e.stopPropagation(); navigate(`/embarques/${h.embarque_id}?tab=${reglaToTab[h.regla]}`); }}
          aria-label={`Abrir embarque ${h.expediente}`}
          title={`Abrir embarque ${h.expediente}`}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </Button>
      ) },
  ];

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

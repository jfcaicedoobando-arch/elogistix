import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

export function OportunidadMobileCard({ oportunidad, etapas }: {
  oportunidad: CrmOportunidadRow;
  etapas: CrmEtapaRow[];
}) {
  const etapa = etapas.find((item) => item.id === oportunidad.etapa_id)?.nombre ?? "Sin etapa";
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-body break-words">{oportunidad.nombre}</p>
          <p className="text-body-sm text-muted-foreground break-words">{oportunidad.cliente_nombre || "Sin cliente o prospecto"}</p>
        </div>
        <Badge variant="neutral">{etapa}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t pt-2 text-body-sm">
        <div><span className="text-label text-muted-foreground">Importe</span><p className="font-medium tabular-nums">{formatCurrency(Number(oportunidad.monto_estimado ?? 0), oportunidad.moneda)}</p></div>
        <div><span className="text-label text-muted-foreground">Cierre estimado</span><p>{oportunidad.fecha_estimada_cierre ? formatFechaEs(oportunidad.fecha_estimada_cierre) : "Sin fecha"}</p></div>
      </div>
    </div>
  );
}
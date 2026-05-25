/**
 * /crm/oportunidades/:id — Detalle de oportunidad con tabs internas.
 * Resumen / Comunicación / Trazabilidad para reducir scroll.
 */
import { useParams } from "react-router-dom";
import { useOportunidad, useEtapasPipeline } from "@/hooks/crm";
import { OportunidadDetalleContent } from "@/components/crm/oportunidadDetalle/OportunidadDetalleContent";

export default function OportunidadDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data: op, isLoading } = useOportunidad(id);
  const { data: etapas = [] } = useEtapasPipeline();

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!op) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Oportunidad no encontrada</div>;
  }
  return <OportunidadDetalleContent op={op} etapas={etapas} />;
}

/**
 * Pestaña "Resumen" del detalle de oportunidad (v13.823.103).
 * Extraída de `OportunidadDetalleContent` para bajar su complejidad.
 */
import { formatFechaDia } from "@/lib/formatters/dates";
import OportunidadCotizacionesList from "@/features/crm/components/OportunidadCotizacionesList";
import { CriteriosSalidaCard } from "./CriteriosSalidaCard";
import { DatosComercialesCard } from "./DatosComercialesCard";
import { MargenAutorizacionCard } from "./MargenAutorizacionCard";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

interface Props {
  op: CrmOportunidadRow;
  etapaNombre?: string;
  canEdit: boolean;
}

export function OportunidadResumenTab({ op, etapaNombre, canEdit }: Props) {
  const fields = [
    { label: "Vendedor", value: op.vendedor_email },
    { label: "Modo", value: op.modo },
    { label: "Cierre estimado", value: formatFechaDia(op.fecha_estimada_cierre) },
    { label: "Origen", value: op.origen },
    { label: "Destino", value: op.destino },
    { label: "Monto meta", value: op.monto_meta != null ? String(op.monto_meta) : null },
    { label: "Fecha meta de cierre", value: formatFechaDia(op.fecha_meta_cierre) },
    { label: "Compromiso", value: op.compromiso_nota, colSpan: true },
    { label: "Notas", value: op.notas, colSpan: true },
  ];

  return (
    <>
      <CriteriosSalidaCard
        oportunidadId={op.id}
        etapaId={op.etapa_id}
        etapaNombre={etapaNombre}
        canEdit={canEdit}
      />
      <DatosComercialesCard fields={fields} />
      <MargenAutorizacionCard
        oportunidadId={op.id}
        margenPct={op.margen_pct != null ? Number(op.margen_pct) : null}
        autorizadoAt={op.margen_autorizado_at ?? null}
        riesgos={op.riesgos_objeciones ?? null}
      />
      <OportunidadCotizacionesList oportunidadId={op.id} />
    </>
  );
}

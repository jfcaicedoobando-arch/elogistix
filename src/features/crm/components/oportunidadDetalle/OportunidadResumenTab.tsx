/**
 * Pestaña "Resumen" del detalle de oportunidad (v13.823.103).
 * Extraída de `OportunidadDetalleContent` para bajar su complejidad.
 */
import { formatFechaDia } from "@/lib/formatters/dates";
import { formatCurrencyCompact } from "@/lib/formatters/numbers";
import OportunidadCotizacionesList from "@/features/crm/components/OportunidadCotizacionesList";
import { CriteriosSalidaCard } from "./CriteriosSalidaCard";
import { DatosComercialesCard } from "./DatosComercialesCard";
import { MargenAutorizacionCard } from "./MargenAutorizacionCard";
import { VinculosCard } from "@/features/crm/components/objetos/VinculosCard";
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
    { label: "Monto meta", value: op.monto_meta != null ? formatCurrencyCompact(Number(op.monto_meta), op.moneda) : null },
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
      <div className="grid gap-4 md:grid-cols-2">
        <VinculosCard
          titulo="Empresas" relacion="empresas-de-oportunidad" duenoId={op.id} rutaBase="/crm/empresas"
          canEdit={canEdit}
          edicion={{ tipo: "oportunidad-empresa", objeto: "empresa", par: (otro) => ({ aId: op.id, bId: otro }) }}
        />
        <VinculosCard
          titulo="Contactos" relacion="contactos-de-oportunidad" duenoId={op.id} rutaBase="/crm/contactos"
          canEdit={canEdit}
          edicion={{ tipo: "oportunidad-contacto", objeto: "contacto", par: (otro) => ({ aId: op.id, bId: otro }) }}
        />
      </div>
      <OportunidadCotizacionesList oportunidadId={op.id} />
    </>
  );
}

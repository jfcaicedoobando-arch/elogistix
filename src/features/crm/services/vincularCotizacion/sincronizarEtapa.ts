/**
 * Sincroniza la etapa de una oportunidad CRM con el estado de la cotización.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchEtapasPipelineActivas } from "@/features/crm/services/etapas";
import { registrarActividad } from "@/services/bitacora/registrar";
import { hoyMx } from "@/lib/date/mx";


/**
 * Mapea el estado de una cotización a la etapa CRM correspondiente y la aplica
 * si la cotización tiene oportunidad vinculada. No-op cuando no hay match.
 */
export async function sincronizarEtapaPorEstadoCotizacion(input: {
  oportunidadId: string;
  estadoCotizacion: string;
}): Promise<void> {
  const etapas = await fetchEtapasPipelineActivas();
  const findByTipo = (tipo: string, nombreHint?: string) => {
    const candidatas = etapas.filter((e) => e.tipo === tipo);
    if (nombreHint) {
      const m = candidatas.find((e) =>
        e.nombre.toLowerCase().includes(nombreHint.toLowerCase()),
      );
      if (m) return m;
    }
    return candidatas[0] ?? null;
  };

  let etapa: { id: string; probabilidad_default: number | null } | null = null;
  let fechaCierreReal: string | null = null;

  switch (input.estadoCotizacion) {
    case "Enviada":
      etapa = findByTipo("abierta", "negoc") ?? findByTipo("abierta", "cotiz");
      break;
    case "Aceptada":
    case "En operación":
      etapa = findByTipo("ganada");
      fechaCierreReal = hoyMx();
      break;
    case "Rechazada":
      etapa = findByTipo("perdida");
      fechaCierreReal = hoyMx();
      break;
    default:
      return;
  }

  if (!etapa) return;
  const patch: { etapa_id: string; probabilidad: number; fecha_cierre_real?: string } = {
    etapa_id: etapa.id,
    probabilidad: etapa.probabilidad_default ?? 0,
  };
  if (fechaCierreReal) patch.fecha_cierre_real = fechaCierreReal;
  const { error } = await supabase
    .from("crm_oportunidades")
    .update(patch)
    .eq("id", input.oportunidadId);
  if (error) throw error;
  await registrarActividad({
    modulo: "crm",
    accion: "sincronizar_etapa_por_estado_cotizacion",
    entidadId: input.oportunidadId,
    detalles: { estado_cotizacion: input.estadoCotizacion, etapa_id: etapa.id },
  });
}

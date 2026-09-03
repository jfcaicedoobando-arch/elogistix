/**
 * Sincroniza la etapa de una oportunidad CRM con el estado de SUS cotizaciones.
 *
 * v13.823.32: antes la etapa se derivaba del ÚLTIMO evento (el estado de la
 * cotización que se acababa de tocar). Con dos cotizaciones alternativas —una
 * aceptada y otra rechazada— rechazar la segunda marcaba la oportunidad como
 * perdida. Ahora se deriva del CONJUNTO de cotizaciones vivas con precedencia:
 *   En operación / Aceptada  >  Enviada / Solicitada  >  Perdida
 * y "Perdida" sólo si TODAS las alternativas vivas están Rechazadas.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchEtapasPipelineActivas } from "@/features/crm/services/etapas";
import { registrarActividad } from "@/services/bitacora/registrar";
import { hoyMx } from "@/lib/date/mx";

type TipoEtapaDerivada = "ganada" | "abierta" | "perdida";

/** Precedencia pura sobre los estados vivos de las cotizaciones. */
export function derivarTipoEtapa(estados: string[]): TipoEtapaDerivada | null {
  if (estados.length === 0) return null;
  if (estados.some((e) => e === "Aceptada" || e === "En operación")) return "ganada";
  if (estados.some((e) => e === "Enviada" || e === "Solicitada")) return "abierta";
  if (estados.every((e) => e === "Rechazada")) return "perdida";
  return null;
}

/**
 * Recalcula y aplica la etapa CRM de la oportunidad a partir de todas sus
 * cotizaciones vivas. No-op cuando no hay un tipo derivable.
 */
export async function sincronizarEtapaPorEstadoCotizacion(input: {
  oportunidadId: string;
  estadoCotizacion: string;
}): Promise<void> {
  const { data: cotizaciones, error: errCot } = await supabase
    .from("cotizaciones")
    .select("id, estado")
    .eq("oportunidad_id", input.oportunidadId)
    .is("deleted_at", null);
  if (errCot) throw errCot;

  const estados = (cotizaciones ?? []).map((c) => String(c.estado));
  const tipo = derivarTipoEtapa(estados);
  if (!tipo) return;

  const etapas = await fetchEtapasPipelineActivas();
  const findByTipo = (t: string, nombreHint?: string) => {
    const candidatas = etapas.filter((e) => e.tipo === t);
    if (nombreHint) {
      const m = candidatas.find((e) =>
        e.nombre.toLowerCase().includes(nombreHint.toLowerCase()),
      );
      if (m) return m;
    }
    return candidatas[0] ?? null;
  };

  const etapa =
    tipo === "abierta"
      ? (findByTipo("abierta", "negoc") ?? findByTipo("abierta", "cotiz"))
      : findByTipo(tipo);
  if (!etapa) return;

  // P1-B (13.823.70): al volver a "abierta" hay que limpiar los datos de cierre;
  // antes quedaban `fecha_cierre_real`/`motivo_perdida_id` históricos y la
  // oportunidad se veía perdida/ganada dentro de una etapa abierta. Se aplica en
  // el MISMO update (atómico) siguiendo la regla de `resolverLimpiezaCierre`.
  const patch: {
    etapa_id: string;
    probabilidad: number;
    fecha_cierre_real?: string | null;
    valor_real?: number | null;
    motivo_perdida_id?: string | null;
  } = {
    etapa_id: etapa.id,
    probabilidad: etapa.probabilidad_default ?? 0,
  };
  if (tipo === "abierta") {
    patch.fecha_cierre_real = null;
    patch.valor_real = null;
    patch.motivo_perdida_id = null;
  } else {
    patch.fecha_cierre_real = hoyMx();
    // "ganada" no conserva motivo de pérdida; "perdida" mantiene el suyo.
    if (tipo === "ganada") patch.motivo_perdida_id = null;
  }


  const { data, error } = await supabase
    .from("crm_oportunidades")
    .update(patch)
    .eq("id", input.oportunidadId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  // 0 filas: la oportunidad ya no existe o RLS la filtró. No inventamos éxito.
  if (!data) return;

  await registrarActividad({
    modulo: "crm",
    accion: "sincronizar_etapa_por_estado_cotizacion",
    entidadId: input.oportunidadId,
    detalles: {
      estado_cotizacion: input.estadoCotizacion,
      estados_vivos: estados,
      tipo_derivado: tipo,
      etapa_id: etapa.id,
    },
  });
}

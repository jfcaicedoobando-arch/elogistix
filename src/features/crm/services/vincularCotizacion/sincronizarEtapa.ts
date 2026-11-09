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
import { calcularValorReal, type CotizacionValor } from "./valorReal";

type TipoEtapaDerivada = "ganada" | "abierta" | "perdida";
interface CierreActual { tipo: string | null; fechaCierre: string | null; moneda: string | null }
interface PatchCierre {
  fecha_cierre_real?: string | null;
  valor_real?: number | null;
  moneda?: string;
  motivo_perdida_id?: string | null;
}

/** Precedencia pura sobre los estados vivos de las cotizaciones. */
export function derivarTipoEtapa(estados: string[]): TipoEtapaDerivada | null {
  if (estados.length === 0) return null;
  if (estados.some((e) => e === "Aceptada" || e === "En operación")) return "ganada";
  if (estados.some((e) => e === "Enviada" || e === "Solicitada")) return "abierta";
  if (estados.every((e) => e === "Rechazada")) return "perdida";
  return null;
}

/**
 * Lee la etapa y el cierre vigentes de la oportunidad. `null` = no existe o RLS
 * la filtró (no inventamos éxito).
 */
async function fetchCierreActual(
  oportunidadId: string,
): Promise<CierreActual | null> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select("id, fecha_cierre_real, moneda, crm_etapas_pipeline(tipo)")
    .eq("id", oportunidadId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // SAFE-CAST: select explícito con join de etapa (una sola fila).
  const row = data as unknown as {
    fecha_cierre_real: string | null;
    moneda: string | null;
    crm_etapas_pipeline?: { tipo?: string | null } | null;
  };
  return { tipo: row.crm_etapas_pipeline?.tipo ?? null, fechaCierre: row.fecha_cierre_real ?? null, moneda: row.moneda ?? null };
}

/** Datos de cierre de la transición, separados de las consultas y del update. */
function crearPatchCierre(
  tipo: TipoEtapaDerivada,
  actual: CierreActual,
  cotizaciones: CotizacionValor[],
): PatchCierre {
  // Reabrir limpia todo el cierre, aunque haya una fecha histórica.
  if (tipo === "abierta") {
    return { fecha_cierre_real: null, valor_real: null, motivo_perdida_id: null };
  }
  const patch: PatchCierre = {};
  const yaCerradaEnMismoTipo = actual.tipo === tipo && actual.fechaCierre != null;
  // Sin transición real conservamos fecha y valor de cierre originales.
  if (!yaCerradaEnMismoTipo) patch.fecha_cierre_real = hoyMx();
  // Ganada limpia el motivo de pérdida; perdida conserva el suyo.
  if (tipo === "ganada") patch.motivo_perdida_id = null;
  if (tipo === "ganada" && !yaCerradaEnMismoTipo) {
    const vr = calcularValorReal(cotizaciones, actual.moneda);
    if (vr) {
      patch.valor_real = vr.valor;
      if (vr.moneda) patch.moneda = vr.moneda;
    }
  }
  return patch;
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
    .select("id, estado, subtotal, moneda, updated_at")
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

  // P1 (13.823.142): si la oportunidad YA está cerrada en el mismo tipo
  // (p. ej. ganada el 31/08), enviar otra alternativa no debe mover la fecha de
  // cierre a hoy. Sólo se fija `fecha_cierre_real` cuando hay transición real.
  const actual = await fetchCierreActual(input.oportunidadId);
  if (!actual) return;
  // El cierre y la etapa se persisten juntos en el mismo update.
  const patch = {
    etapa_id: etapa.id,
    probabilidad: etapa.probabilidad_default ?? 0,
    // SAFE-CAST: select explícito de columnas de cotización.
    ...crearPatchCierre(tipo, actual, (cotizaciones ?? []) as unknown as CotizacionValor[]),
  };

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

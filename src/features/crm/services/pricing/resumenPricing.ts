/**
 * Resumen de solicitudes de pricing para el Resumen ejecutivo del CRM:
 * conteo por estatus y tiempo de respuesta (created_at → respondida_at).
 * Lectura ligera: sólo las columnas necesarias, acotada a las más recientes.
 */
import { supabase } from "@/integrations/supabase/client";
import { ETIQUETA_ESTADO_PRICING } from "./tiposPricing";

export interface ResumenPricing {
  /** Conteo por estatus (sin borradores), en el orden del catálogo. */
  porEstado: { estado: string; etiqueta: string; cantidad: number }[];
  total: number;
  /** Horas promedio de respuesta de las solicitudes respondidas; null si no hay. */
  horasPromedioRespuesta: number | null;
  respondidas: number;
  /** Respondidas dentro de su fecha compromiso (vence_at). */
  respondidasATiempo: number;
}

const HORAS_EN_MS = 3_600_000;

export async function obtenerResumenPricing(): Promise<ResumenPricing> {
  const { data, error } = await supabase
    .from("crm_solicitudes_pricing")
    .select("estado, created_at, respondida_at, vence_at")
    .is("deleted_at", null)
    .neq("estado", "borrador")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const filas = data ?? [];
  const conteo = new Map<string, number>();
  let sumaHoras = 0;
  let respondidas = 0;
  let aTiempo = 0;

  for (const f of filas) {
    conteo.set(f.estado, (conteo.get(f.estado) ?? 0) + 1);
    if (f.estado === "respondida" && f.respondida_at) {
      const horas = (Date.parse(f.respondida_at) - Date.parse(f.created_at)) / HORAS_EN_MS;
      if (Number.isFinite(horas) && horas >= 0) {
        sumaHoras += horas;
        respondidas += 1;
        if (!f.vence_at || Date.parse(f.respondida_at) <= Date.parse(f.vence_at)) aTiempo += 1;
      }
    }
  }

  const orden = ["enviada", "respondida", "cancelada"];
  const porEstado = orden
    .filter((e) => conteo.has(e))
    .map((e) => ({ estado: e, etiqueta: ETIQUETA_ESTADO_PRICING[e] ?? e, cantidad: conteo.get(e) ?? 0 }));

  return {
    porEstado,
    total: filas.length,
    horasPromedioRespuesta: respondidas > 0 ? sumaHoras / respondidas : null,
    respondidas,
    respondidasATiempo: aTiempo,
  };
}

/** Formatea horas como "8 h" o "1.5 d". */
export function formatoHorasRespuesta(horas: number): string {
  if (horas < 48) return `${Math.round(horas)} h`;
  return `${(horas / 24).toFixed(1)} d`;
}

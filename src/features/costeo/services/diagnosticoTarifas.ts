/**
 * Diagnóstico de por qué el Top 3 no devolvió tarifas para una combinación.
 *
 * P2 (2026-09-02): el wizard decía "No hay tarifas vigentes" aunque existía la
 * tarifa exacta en borrador pendiente de aprobación. Se conserva el bloqueo,
 * pero la UI ahora distingue tres situaciones distintas.
 *
 * Analogía: no es lo mismo "no hay vuelo" que "el vuelo existe pero aún no
 * abrió el registro".
 */
import { supabase } from "@/integrations/supabase/client";
import { esVigenciaVencida } from "@/features/costeo/utils/vigenciaTarifa";

export type DiagnosticoTarifas = "ninguna" | "pendiente" | "vencida";

export interface DiagnosticoTarifasParams {
  puertoOrigenId: string;
  puertoDestinoId: string;
  /** IDs equivalentes del tipo de contenedor (ver dedupe del catálogo). */
  tipoContenedorIds: string[];
  /** Día de negocio México (`todayLocalISO()`). */
  hoy: string;
  organizationId: string;
}

const LIMITE_DIAGNOSTICO = 50;

interface FilaDiagnostico {
  estado_aprobacion: string | null;
  vigente_hasta: string;
}

export async function fetchDiagnosticoTarifas(
  p: DiagnosticoTarifasParams,
): Promise<DiagnosticoTarifas> {
  const { data, error } = await supabase
    .from("costeo_tarifas")
    .select("estado_aprobacion, vigente_hasta, costeo_rutas!inner(puerto_origen_id, puerto_destino_id)")
    .eq("organization_id", p.organizationId)
    .in("tipo_contenedor_id", p.tipoContenedorIds)
    .eq("costeo_rutas.puerto_origen_id", p.puertoOrigenId)
    .eq("costeo_rutas.puerto_destino_id", p.puertoDestinoId)
    .limit(LIMITE_DIAGNOSTICO);
  if (error) throw error;

  // SAFE-CAST: el join anidado hace que el cliente generado infiera `never`.
  const filas = ((data ?? []) as unknown as FilaDiagnostico[]).filter(
    (f) => f.estado_aprobacion !== "rechazada",
  );
  if (filas.length === 0) return "ninguna";
  if (filas.some((f) => f.estado_aprobacion === "borrador")) return "pendiente";
  if (filas.every((f) => esVigenciaVencida(f.vigente_hasta, p.hoy))) return "vencida";
  return "ninguna";
}

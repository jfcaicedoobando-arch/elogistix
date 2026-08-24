/**
 * FIX2 · B-1 — Columnas internas de un embarque (PnL de cierre, delta de
 * tarifa, motivo de reapertura y correo del creador).
 *
 * La tabla `embarques` ya NO expone estas columnas a `authenticated`
 * (REVOKE de privilegio de columna) porque RLS filtra filas, no columnas y un
 * usuario del portal podía leerlas con `select=*`. El staff las obtiene por la
 * vista `embarques_interno_v`, que valida membresía de organización y excluye
 * a los roles de portal (`cliente`, `agente_carga`).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmbarqueInterno {
  cerrado_snapshot: unknown;
  tarifa_delta_jsonb: unknown;
  reabierto_motivo: string | null;
  created_by_email: string | null;
}

const COLUMNAS_INTERNAS =
  "cerrado_snapshot, tarifa_delta_jsonb, reabierto_motivo, created_by_email" as const;

/**
 * Devuelve las columnas internas del embarque, o `null` si el usuario no es
 * staff de la organización (la vista simplemente no devuelve la fila).
 */
export async function obtenerEmbarqueInterno(
  embarqueId: string,
): Promise<EmbarqueInterno | null> {
  const { data, error } = await supabase
    .from("embarques_interno_v")
    .select(COLUMNAS_INTERNAS)
    .eq("id", embarqueId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    cerrado_snapshot: data.cerrado_snapshot ?? null,
    tarifa_delta_jsonb: data.tarifa_delta_jsonb ?? null,
    reabierto_motivo: data.reabierto_motivo ?? null,
    created_by_email: data.created_by_email ?? null,
  };
}

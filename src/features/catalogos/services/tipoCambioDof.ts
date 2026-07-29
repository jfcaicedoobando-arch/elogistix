/**
 * Servicio del historial de Tipo de Cambio DOF (`tipos_cambio_dof`).
 * Alimentado a diario por el cron `tc-dof-diario`; permite consulta y
 * captura manual (RPC `tc_dof_upsert_manual`, sólo roles administrativos).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";

export interface TipoCambioDof {
  fecha: string;
  usd_mxn: number;
  eur_mxn: number | null;
  fuente: string;
  origen: string;
  updated_at: string;
}

const COLUMNAS = "fecha, usd_mxn, eur_mxn, fuente, origen, updated_at";

/** Últimos N registros del historial, del más reciente al más antiguo. */
export async function fetchHistorialTcDof(limite = 60): Promise<TipoCambioDof[]> {
  const query = supabase
    .from("tipos_cambio_dof")
    .select(COLUMNAS)
    .order("fecha", { ascending: false })
    .limit(Math.min(Math.max(limite, 1), 365));
  const rows = await unwrapOr(query, []);
  return (rows ?? []) as TipoCambioDof[];
}

/** Alta/corrección manual de un día (requiere rol administrativo o contador). */
export async function upsertTcDofManual(input: {
  fecha: string;
  usdMxn: number;
  eurMxn?: number | null;
}): Promise<void> {
  await run(
    supabase.rpc("tc_dof_upsert_manual", {
      _fecha: input.fecha,
      _usd: input.usdMxn,
      _eur: input.eurMxn ?? null,
    }),
  );
}

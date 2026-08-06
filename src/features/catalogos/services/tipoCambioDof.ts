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

/** TC DOF vigente en una fecha (`exacto: false` = último publicado antes de ella). */
export interface TcDofVigente {
  usdMxn: number;
  eurMxn: number | null;
  /** Fecha de publicación DOF usada (ISO `YYYY-MM-DD`). */
  fecha: string;
  exacto: boolean;
}

/**
 * TC DOF vigente para una fecha dada. Si ese día no se publicó (fin de semana,
 * día inhábil), devuelve el último publicado antes de esa fecha.
 */
export async function fetchTcDofPorFecha(fecha: string): Promise<TcDofVigente | null> {
  const query = supabase
    .from("tipos_cambio_dof")
    .select(COLUMNAS)
    .lte("fecha", fecha)
    .order("fecha", { ascending: false })
    .limit(1);
  const rows = await unwrapOr(query, []);
  const fila = (rows ?? [])[0] as TipoCambioDof | undefined;
  if (!fila || !(Number(fila.usd_mxn) > 0)) return null;
  return {
    usdMxn: Number(fila.usd_mxn),
    eurMxn: fila.eur_mxn == null ? null : Number(fila.eur_mxn),
    fecha: fila.fecha,
    exacto: fila.fecha === fecha,
  };
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
      _eur: input.eurMxn ?? undefined,
    }),
  );
}

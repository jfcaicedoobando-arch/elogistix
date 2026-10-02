/**
 * Puntaje A/B/C del CRM (Fase 6). El cálculo vive en la base
 * (`crm_puntaje_detalle`) y siempre usa los datos vigentes: nada se guarda.
 */
import { supabase } from "@/integrations/supabase/client";

export type ObjetoPuntaje = "empresa" | "oportunidad";
export type LetraPuntaje = "A" | "B" | "C";
export const LETRAS_PUNTAJE: LetraPuntaje[] = ["A", "B", "C"];

export interface CriterioPuntaje { criterio: string; puntos: number; maximo: number }
export interface PuntajeDetalle {
  puntaje: number | null;
  letra: LetraPuntaje | null;
  desglose: CriterioPuntaje[];
  cerrada: boolean;
}
export interface PuntajeFila { puntaje: number; letra: LetraPuntaje }

function esLetra(v: unknown): v is LetraPuntaje {
  return v === "A" || v === "B" || v === "C";
}

/** Normaliza el JSON de la base (defensivo ante campos faltantes). */
export function parsePuntajeDetalle(raw: unknown): PuntajeDetalle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const desglose = Array.isArray(r.desglose) ? r.desglose : [];
  return {
    puntaje: typeof r.puntaje === "number" ? r.puntaje : null,
    letra: esLetra(r.letra) ? r.letra : null,
    cerrada: r.cerrada === true,
    desglose: desglose.map((d) => {
      const x = (d ?? {}) as Record<string, unknown>;
      return { criterio: String(x.criterio ?? ""), puntos: Number(x.puntos ?? 0), maximo: Number(x.maximo ?? 0) };
    }),
  };
}

export async function fetchPuntajeDetalle(objeto: ObjetoPuntaje, id: string): Promise<PuntajeDetalle | null> {
  const { data, error } = await supabase.rpc("crm_puntaje_detalle", { p_objeto: objeto, p_id: id });
  if (error) throw error;
  return parsePuntajeDetalle(data);
}

export async function fetchPuntajes(objeto: ObjetoPuntaje, ids: string[]): Promise<Map<string, PuntajeFila>> {
  const mapa = new Map<string, PuntajeFila>();
  if (ids.length === 0) return mapa;
  const { data, error } = await supabase.rpc("crm_puntajes", { p_objeto: objeto, p_ids: ids.slice(0, 500) });
  if (error) throw error;
  for (const f of data ?? []) {
    if (f.id && typeof f.puntaje === "number" && esLetra(f.letra)) mapa.set(f.id, { puntaje: f.puntaje, letra: f.letra });
  }
  return mapa;
}

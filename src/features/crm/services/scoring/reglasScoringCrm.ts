/**
 * Configuración del puntaje (solo súper administrador; RLS lo garantiza).
 * Cada regla es un "escalón": el criterio suma los puntos del escalón más alto que cumpla.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ObjetoPuntaje } from "./scoringCrm";

export type FuenteRegla = "propiedad" | "monto_usd" | "etapa" | "contacto_ligado" | "pricing_respondida";

export const ETIQUETA_FUENTE: Record<FuenteRegla, string> = {
  propiedad: "Propiedad del CRM",
  monto_usd: "Monto estimado (USD)",
  etapa: "Etapa",
  contacto_ligado: "Tiene contacto ligado",
  pricing_respondida: "Solicitud a Pricing respondida",
};

export interface ReglaScoring {
  id: string; objeto: ObjetoPuntaje; criterio: string; fuente: FuenteRegla;
  propiedad_id: string | null; opcion_id: string | null; valor_texto: string | null;
  min: number | null; max: number | null; puntos: number; orden: number; activa: boolean;
}
export type NuevaRegla = Omit<ReglaScoring, "id">;
export interface Cortes { objeto: ObjetoPuntaje; min_a: number; min_b: number }

const COLS = "id, objeto, criterio, fuente, propiedad_id, opcion_id, valor_texto, min, max, puntos, orden, activa";

export async function listarReglas(objeto: ObjetoPuntaje): Promise<ReglaScoring[]> {
  const { data, error } = await supabase.from("crm_scoring_reglas").select(COLS)
    .eq("objeto", objeto).order("orden").order("puntos", { ascending: false }).limit(300);
  if (error) throw error;
  // SAFE-CAST: los CHECK de la tabla restringen objeto y fuente a estas uniones.
  return (data ?? []) as ReglaScoring[];
}

/** Valida antes de enviar; devuelve el mensaje de error o null. */
export function validarRegla(r: Pick<NuevaRegla, "criterio" | "fuente" | "propiedad_id" | "valor_texto" | "min" | "max" | "puntos">): string | null {
  if (!r.criterio.trim()) return "Escribe el nombre del criterio.";
  if (!Number.isInteger(r.puntos) || r.puntos < 0 || r.puntos > 100) return "Los puntos van de 0 a 100.";
  if (r.fuente === "propiedad" && !r.propiedad_id) return "Elige la propiedad.";
  if (r.fuente === "etapa" && !r.valor_texto?.trim()) return "Escribe el nombre de la etapa.";
  if (r.min !== null && r.max !== null && r.min >= r.max) return "El mínimo debe ser menor que el máximo.";
  return null;
}

export async function crearRegla(r: NuevaRegla): Promise<void> {
  const msg = validarRegla(r);
  if (msg) throw new Error(msg);
  const { error } = await supabase.from("crm_scoring_reglas").insert({ ...r, criterio: r.criterio.trim() });
  if (error) throw error;
}

export async function actualizarRegla(id: string, cambio: Partial<Pick<ReglaScoring, "puntos" | "min" | "max" | "activa">>): Promise<void> {
  if (cambio.puntos !== undefined && (!Number.isInteger(cambio.puntos) || cambio.puntos < 0 || cambio.puntos > 100)) {
    throw new Error("Los puntos van de 0 a 100.");
  }
  const { error } = await supabase.from("crm_scoring_reglas").update(cambio).eq("id", id);
  if (error) throw error;
}

export async function eliminarRegla(id: string): Promise<void> {
  const { error } = await supabase.from("crm_scoring_reglas").delete().eq("id", id);
  if (error) throw error;
}

export async function listarCortes(): Promise<Cortes[]> {
  const { data, error } = await supabase.from("crm_scoring_cortes").select("objeto, min_a, min_b");
  if (error) throw error;
  // SAFE-CAST: CHECK de la tabla.
  return (data ?? []) as Cortes[];
}

export function validarCortes(minA: number, minB: number): string | null {
  if (!Number.isInteger(minA) || !Number.isInteger(minB)) return "Usa números enteros.";
  if (minA < 1 || minA > 100 || minB < 0 || minB > 100) return "Los cortes van de 0 a 100.";
  if (minB >= minA) return "El corte de B debe ser menor que el de A.";
  return null;
}

export async function guardarCortes(c: Cortes): Promise<void> {
  const msg = validarCortes(c.min_a, c.min_b);
  if (msg) throw new Error(msg);
  const { error } = await supabase.from("crm_scoring_cortes").upsert(c, { onConflict: "objeto" });
  if (error) throw error;
}

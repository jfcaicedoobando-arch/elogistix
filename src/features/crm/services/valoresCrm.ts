/**
 * Valores de propiedades por registro del CRM (Fase 3). Formato EAV:
 * una fila por (propiedad, registro). RLS los aísla por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TipoPropiedad } from "./propiedadesCrm";

export interface ValorCrm {
  propiedad_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_fecha: string | null;
  opcion_ids: string[] | null;
}

export type ValorEntrada = string | number | string[] | null;

export async function fetchValores(registroId: string): Promise<ValorCrm[]> {
  const { data, error } = await supabase.from("crm_valores")
    .select("propiedad_id, valor_texto, valor_numero, valor_fecha, opcion_ids")
    .eq("registro_id", registroId).limit(200);
  if (error) throw error;
  return data ?? [];
}

/** Convierte la captura a la columna correcta según el tipo; vacíos quedan en null. */
export function filaValor(tipo: TipoPropiedad, valor: ValorEntrada): Omit<ValorCrm, "propiedad_id"> {
  const vacio = { valor_texto: null, valor_numero: null, valor_fecha: null, opcion_ids: null };
  if (valor === null || valor === "" || (Array.isArray(valor) && valor.length === 0)) return vacio;
  switch (tipo) {
    case "texto": return { ...vacio, valor_texto: String(valor).trim() || null };
    case "numero": {
      const n = Number(valor);
      if (!Number.isFinite(n)) throw new Error("Escribe un número válido");
      return { ...vacio, valor_numero: n };
    }
    case "fecha": return { ...vacio, valor_fecha: String(valor) };
    case "seleccion": return { ...vacio, opcion_ids: [String(valor)] };
    case "multiseleccion": return { ...vacio, opcion_ids: Array.isArray(valor) ? valor : [String(valor)] };
  }
}

export async function guardarValor(
  propiedadId: string, registroId: string, tipo: TipoPropiedad, valor: ValorEntrada,
): Promise<void> {
  const fila = { propiedad_id: propiedadId, registro_id: registroId, ...filaValor(tipo, valor), updated_at: new Date().toISOString() };
  const { error } = await supabase.from("crm_valores").upsert(fila, { onConflict: "propiedad_id,registro_id" });
  if (error) throw error;
}

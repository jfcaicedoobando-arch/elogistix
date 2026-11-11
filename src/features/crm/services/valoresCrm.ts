/**
 * Valores de propiedades por registro del CRM (Fase 3). Formato EAV:
 * una fila por (propiedad, registro). RLS los aísla por organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
import type { TipoPropiedad } from "./propiedadesCrm";

export interface ValorCrm {
  propiedad_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_fecha: string | null;
  opcion_ids: string[] | null;
}

export type ValorEntrada = string | number | string[] | null;
export type ValorCrmPersistido = ValorCrm & { updated_at: string };

const COLS_VALOR = "propiedad_id, valor_texto, valor_numero, valor_fecha, opcion_ids, updated_at";

export class ConflictoValorCrm extends ReglaNegocioError {
  constructor() {
    super("El valor cambió mientras editabas. Revisa el valor actual antes de volver a guardar.");
  }
}

export async function fetchValores(registroId: string): Promise<ValorCrmPersistido[]> {
  const { data, error } = await supabase.from("crm_valores")
    .select(COLS_VALOR)
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
  propiedadId: string, registroId: string, tipo: TipoPropiedad, valor: ValorEntrada, version: string | null,
): Promise<ValorCrmPersistido> {
  const scope = captureAuthOperationScope();
  const fecha = version === null ? Date.now() : Math.max(Date.now(), Date.parse(version) + 1);
  const fila = { ...filaValor(tipo, valor), updated_at: new Date(fecha).toISOString() };
  const tabla = supabase.from("crm_valores");
  const query = version === null
    ? tabla.insert({ ...fila, propiedad_id: propiedadId, registro_id: registroId })
    : tabla.update(fila).eq("propiedad_id", propiedadId).eq("registro_id", registroId).eq("updated_at", version);
  const { data, error } = await query.select(COLS_VALOR).maybeSingle();
  scope.assertCurrent();
  if (version === null && error?.code === "23505") throw new ConflictoValorCrm();
  if (error) throw error;
  if (!data) throw new ConflictoValorCrm();
  return data;
}

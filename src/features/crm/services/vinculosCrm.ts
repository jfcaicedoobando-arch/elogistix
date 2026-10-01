/**
 * Vínculos muchos-a-muchos del CRM por objetos (Fase 2).
 * Cada vínculo es un par de ids; ligar dos veces es idempotente (upsert).
 */
import { supabase } from "@/integrations/supabase/client";
import type { RefRow } from "./objetosCrm";

/** Tipo de vínculo soportado y sus columnas. */
export type TipoVinculo = "empresa-contacto" | "oportunidad-empresa" | "oportunidad-contacto";

const CONFIG = {
  "empresa-contacto": { tabla: "crm_empresa_contacto", a: "empresa_id", b: "contacto_id" },
  "oportunidad-empresa": { tabla: "crm_oportunidad_empresa", a: "oportunidad_id", b: "empresa_id" },
  "oportunidad-contacto": { tabla: "crm_oportunidad_contacto", a: "oportunidad_id", b: "contacto_id" },
} as const;

export async function ligar(tipo: TipoVinculo, aId: string, bId: string): Promise<void> {
  const c = CONFIG[tipo];
  const fila = { [c.a]: aId, [c.b]: bId } as Record<string, string>;
  // SAFE-CAST: la tabla viene de un mapa cerrado; el payload solo trae las 2 llaves.
  const { error } = await supabase.from(c.tabla).upsert(fila as never, { onConflict: `${c.a},${c.b}`, ignoreDuplicates: true });
  if (error) throw error;
}

export async function desligar(tipo: TipoVinculo, aId: string, bId: string): Promise<void> {
  const c = CONFIG[tipo];
  const { error } = await supabase.from(c.tabla).delete().eq(c.a, aId).eq(c.b, bId);
  if (error) throw error;
}

type Embebido = { id: string; nombre: string } | null;

function aplanar(filas: Array<Record<string, Embebido>> | null, clave: string): RefRow[] {
  return (filas ?? []).map((f) => f[clave]).filter((x): x is RefRow => x != null)
    .sort((x, y) => x.nombre.localeCompare(y.nombre, "es-MX"));
}

export async function contactosDeEmpresa(empresaId: string): Promise<RefRow[]> {
  const { data, error } = await supabase.from("crm_empresa_contacto")
    .select("crm_contactos(id, nombre)").eq("empresa_id", empresaId).limit(200);
  if (error) throw error;
  return aplanar(data as never, "crm_contactos");
}

export async function empresasDeContacto(contactoId: string): Promise<RefRow[]> {
  const { data, error } = await supabase.from("crm_empresa_contacto")
    .select("crm_empresas(id, nombre)").eq("contacto_id", contactoId).limit(200);
  if (error) throw error;
  return aplanar(data as never, "crm_empresas");
}

export async function oportunidadesDe(tipo: "empresa" | "contacto", id: string): Promise<RefRow[]> {
  const tabla = tipo === "empresa" ? "crm_oportunidad_empresa" : "crm_oportunidad_contacto";
  const { data, error } = await supabase.from(tabla)
    .select("crm_oportunidades(id, nombre)").eq(`${tipo}_id`, id).limit(200);
  if (error) throw error;
  return aplanar(data as never, "crm_oportunidades");
}

export async function empresasDeOportunidad(oportunidadId: string): Promise<RefRow[]> {
  const { data, error } = await supabase.from("crm_oportunidad_empresa")
    .select("crm_empresas(id, nombre)").eq("oportunidad_id", oportunidadId).limit(200);
  if (error) throw error;
  return aplanar(data as never, "crm_empresas");
}

export async function contactosDeOportunidad(oportunidadId: string): Promise<RefRow[]> {
  const { data, error } = await supabase.from("crm_oportunidad_contacto")
    .select("crm_contactos(id, nombre)").eq("oportunidad_id", oportunidadId).limit(200);
  if (error) throw error;
  return aplanar(data as never, "crm_contactos");
}

/**
 * Cargos FOB por agente y cargos locales de revalidación por naviera.
 * Borrar = soft-delete (`deleted_at`), nunca DELETE.
 */
import { z } from "zod";
import { CAP_LISTA } from "@/constants/queryCaps";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export type TipoCargo = "fob" | "locales";

const TABLA = { fob: "costeo_cargos_fob_agente", locales: "costeo_cargos_locales_naviera" } as const;

const cargoSchema = z.array(z.object({
  id: z.string(),
  concepto: z.string(),
  monto: z.number(),
  moneda: z.string(),
  unidad: z.string().nullable(),
  entidad_id: z.string(),
  entidad: z.object({ nombre: z.string() }).passthrough().nullable(),
}).passthrough());

export type CargoTarifario = z.infer<typeof cargoSchema>[number];

const SELECT = {
  fob: "id, concepto, monto, moneda, unidad, entidad_id:agente_id, entidad:costeo_agentes(nombre)",
  locales: "id, concepto, monto, moneda, unidad, entidad_id:naviera_id, entidad:navieras(nombre:name)",
} as const;

export async function listarCargos(tipo: TipoCargo): Promise<CargoTarifario[]> {
  const { data, error } = await supabase.from(TABLA[tipo]).select(SELECT[tipo])
    .is("deleted_at", null).order("created_at", { ascending: false }).limit(CAP_LISTA);
  if (error) throw error;
  return fromDb(data ?? [], cargoSchema);
}

export interface CargoInput {
  entidad_id: string;
  concepto: string;
  monto: number;
  moneda: string;
  unidad: string | null;
}

export async function guardarCargo(tipo: TipoCargo, orgId: string, input: CargoInput, id?: string): Promise<void> {
  const base = { concepto: input.concepto, monto: input.monto, moneda: input.moneda, unidad: input.unidad };
  if (tipo === "fob") {
    const fila = { ...base, agente_id: input.entidad_id, organization_id: orgId };
    const { error } = id
      ? await supabase.from("costeo_cargos_fob_agente").update({ ...fila, updated_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("costeo_cargos_fob_agente").insert(fila);
    if (error) throw error;
    return;
  }
  const fila = { ...base, naviera_id: input.entidad_id, organization_id: orgId };
  const { error } = id
    ? await supabase.from("costeo_cargos_locales_naviera").update({ ...fila, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("costeo_cargos_locales_naviera").insert(fila);
  if (error) throw error;
}

export async function archivarCargo(tipo: TipoCargo, id: string): Promise<void> {
  const { error } = await supabase.from(TABLA[tipo]).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function aplicarTarifaTarifario(solicitudId: string, tarifaId: string): Promise<void> {
  const { error } = await supabase.rpc("crm_aplicar_tarifa_tarifario", { p_solicitud_id: solicitudId, p_tarifa_id: tarifaId });
  if (error) throw error;
}

export async function listarEntidadesCargo(tipo: TipoCargo): Promise<{ id: string; nombre: string }[]> {
  if (tipo === "fob") {
    const { data, error } = await supabase.from("costeo_agentes").select("id, nombre").eq("activo", true).order("nombre").limit(CAP_LISTA);
    if (error) throw error;
    return data ?? [];
  }
  const { data, error } = await supabase.from("navieras").select("id, name").eq("activo", true).order("name").limit(CAP_LISTA);
  if (error) throw error;
  return (data ?? []).map((n) => ({ id: n.id, nombre: n.name }));
}

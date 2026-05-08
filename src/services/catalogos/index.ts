/**
 * Servicio de catálogos compartidos: navieras, puertos, tipos de contenedor
 * y tipo de cambio. Encapsula CRUD y RPC contra Supabase para que los hooks
 * solo manejen estado de React Query.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Naviera {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
}

export interface Puerto {
  id: string;
  code: string;
  name: string;
  country: string;
  activo: boolean;
  created_at: string;
}

export interface TipoContenedor {
  id: string;
  code: string;
  name: string;
  activo: boolean;
  created_at: string;
}

export interface ExchangeRates {
  usdMxn: number;
  eurMxn: number;
}

// ─── Navieras ────────────────────────────────────────────────────────────────

export async function fetchNavieras(includeInactive = false): Promise<Naviera[]> {
  let query = supabase.from("navieras").select("*").order("name");
  if (!includeInactive) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;
  return fromDb<Naviera[]>(data ?? []);
}

export async function insertNaviera(input: { code: string; name: string }): Promise<void> {
  const { error } = await supabase.from("navieras").insert(input);
  if (error) throw error;
}

export async function setNavieraActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("navieras").update({ activo }).eq("id", id);
  if (error) throw error;
}

export async function deleteNaviera(id: string): Promise<void> {
  const { error } = await supabase.from("navieras").delete().eq("id", id);
  if (error) throw error;
}

// ─── Puertos ─────────────────────────────────────────────────────────────────

export async function fetchPuertos(includeInactive = false): Promise<Puerto[]> {
  let query = supabase.from("puertos").select("*").order("country").order("name");
  if (!includeInactive) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;
  return fromDb<Puerto[]>(data ?? []);
}

export async function insertPuerto(input: { code: string; name: string; country: string }): Promise<void> {
  const { error } = await supabase.from("puertos").insert(input);
  if (error) throw error;
}

export async function setPuertoActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("puertos").update({ activo }).eq("id", id);
  if (error) throw error;
}

export async function deletePuerto(id: string): Promise<void> {
  const { error } = await supabase.from("puertos").delete().eq("id", id);
  if (error) throw error;
}

// ─── Tipos de contenedor ─────────────────────────────────────────────────────

export async function fetchTiposContenedor(includeInactive = false): Promise<TipoContenedor[]> {
  let query = supabase.from("tipos_contenedor").select("*").order("name");
  if (!includeInactive) query = query.eq("activo", true);
  const { data, error } = await query;
  if (error) throw error;
  return fromDb<TipoContenedor[]>(data ?? []);
}

export async function insertTipoContenedor(input: { code: string; name: string }): Promise<void> {
  const { error } = await supabase.from("tipos_contenedor").insert(input);
  if (error) throw error;
}

export async function setTipoContenedorActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from("tipos_contenedor").update({ activo }).eq("id", id);
  if (error) throw error;
}

export async function deleteTipoContenedor(id: string): Promise<void> {
  const { error } = await supabase.from("tipos_contenedor").delete().eq("id", id);
  if (error) throw error;
}

// ─── Tipo de cambio (edge function) ──────────────────────────────────────────

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const { data, error } = await supabase.functions.invoke("exchange-rates");
  if (error) throw error;
  return {
    usdMxn: data?.usdMxn ?? 17.25,
    eurMxn: data?.eurMxn ?? 18.5,
  };
}

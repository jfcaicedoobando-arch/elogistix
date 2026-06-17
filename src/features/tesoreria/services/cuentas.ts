/**
 * CRUD de cuentas bancarias (tesorería).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type CuentaBancaria = Tables<"cuentas_bancarias">;

// v13.56.1 — Columnas explícitas (evita SELECT * en tablas financieras).
const CUENTA_BANCARIA_COLUMNS =
  "id, organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, activa, notas, created_at, updated_at, deleted_at, deleted_by";

export async function listarCuentas(activas = true): Promise<CuentaBancaria[]> {
  let q = supabase.from("cuentas_bancarias").select(CUENTA_BANCARIA_COLUMNS).order("alias", { ascending: true });
  if (activas) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CuentaBancaria[];
}

export async function crearCuenta(payload: TablesInsert<"cuentas_bancarias">) {
  const { data, error } = await supabase.from("cuentas_bancarias").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarCuenta(id: string, patch: TablesUpdate<"cuentas_bancarias">) {
  const { data, error } = await supabase.from("cuentas_bancarias").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarCuenta(id: string, userId: string | null) {
  const { error } = await supabase
    .from("cuentas_bancarias")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId, activa: false })
    .eq("id", id);
  if (error) throw error;
}

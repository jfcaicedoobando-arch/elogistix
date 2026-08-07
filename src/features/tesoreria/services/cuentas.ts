/**
 * CRUD de cuentas bancarias (tesorería).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";

export type CuentaBancaria = Tables<"cuentas_bancarias">;

// v13.56.1 — Columnas explícitas (evita SELECT * en tablas financieras).
const CUENTA_BANCARIA_COLUMNS =
  "id, organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, fecha_saldo_inicial, activa, notas, created_at, updated_at, deleted_at, deleted_by";

export async function listarCuentas(activas = true): Promise<CuentaBancaria[]> {
  let q = supabase.from("cuentas_bancarias").select(CUENTA_BANCARIA_COLUMNS).order("alias", { ascending: true });
  if (activas) q = q.eq("activa", true);
  return unwrapOr(q, [] as CuentaBancaria[]) as Promise<CuentaBancaria[]>;
}

export async function crearCuenta(payload: TablesInsert<"cuentas_bancarias">): Promise<CuentaBancaria> {
  return unwrap(supabase.from("cuentas_bancarias").insert(payload).select().single()) as Promise<CuentaBancaria>;
}

export async function actualizarCuenta(id: string, patch: TablesUpdate<"cuentas_bancarias">): Promise<CuentaBancaria> {
  return unwrap(supabase.from("cuentas_bancarias").update(patch).eq("id", id).select().single()) as Promise<CuentaBancaria>;
}

export async function eliminarCuenta(id: string, userId: string | null) {
  await run(
    supabase
      .from("cuentas_bancarias")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId, activa: false })
      .eq("id", id),
  );
}

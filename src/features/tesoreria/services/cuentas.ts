/**
 * CRUD de cuentas bancarias (tesorería).
 *
 * v13.453.0 — Toda alta/edición/baja de cuenta queda registrada en la bitácora
 * del sistema (módulo `tesoreria`): son datos que afectan saldos y conciliación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

export type CuentaBancaria = Tables<"cuentas_bancarias">;

// v13.56.1 — Columnas explícitas (evita SELECT * en tablas financieras).
const CUENTA_BANCARIA_COLUMNS =
  "id, organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, fecha_saldo_inicial, activa, notas, created_at, updated_at, deleted_at, deleted_by";

function etiquetaCuentaBitacora(cuenta: Pick<CuentaBancaria, "banco" | "alias" | "moneda">): string {
  return [cuenta.alias || cuenta.banco, cuenta.moneda].filter(Boolean).join(" · ");
}

export async function listarCuentas(activas = true): Promise<CuentaBancaria[]> {
  let q = supabase.from("cuentas_bancarias").select(CUENTA_BANCARIA_COLUMNS).order("alias", { ascending: true });
  if (activas) q = q.eq("activa", true);
  return unwrapOr(q, [] as CuentaBancaria[]) as Promise<CuentaBancaria[]>;
}

export async function crearCuenta(payload: TablesInsert<"cuentas_bancarias">): Promise<CuentaBancaria> {
  const cuenta = (await unwrap(
    supabase.from("cuentas_bancarias").insert(payload).select().single(),
  )) as CuentaBancaria;
  await registrarActividad({
    modulo: "tesoreria",
    accion: "crear_cuenta_bancaria",
    entidadId: cuenta.id,
    entidadNombre: etiquetaCuentaBitacora(cuenta),
    detalles: {
      banco: cuenta.banco,
      moneda: cuenta.moneda,
      saldo_inicial: cuenta.saldo_inicial,
      fecha_saldo_inicial: cuenta.fecha_saldo_inicial,
    },
  });
  return cuenta;
}

export async function actualizarCuenta(id: string, patch: TablesUpdate<"cuentas_bancarias">): Promise<CuentaBancaria> {
  const cuenta = (await unwrap(
    supabase.from("cuentas_bancarias").update(patch).eq("id", id).select().single(),
  )) as CuentaBancaria;
  await registrarActividad({
    modulo: "tesoreria",
    accion: "editar_cuenta_bancaria",
    entidadId: id,
    entidadNombre: etiquetaCuentaBitacora(cuenta),
    detalles: { campos: Object.keys(patch), valores: patch as Record<string, unknown> },
  });
  return cuenta;
}

export async function eliminarCuenta(id: string, userId: string | null) {
  await run(
    supabase
      .from("cuentas_bancarias")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId, activa: false })
      .eq("id", id),
  );
  await registrarActividad({
    modulo: "tesoreria",
    accion: "eliminar_cuenta_bancaria",
    entidadId: id,
    detalles: { deleted_by: userId },
  });
}

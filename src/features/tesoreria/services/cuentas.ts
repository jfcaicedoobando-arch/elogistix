/**
 * CRUD de cuentas bancarias (tesorería).
 *
 * v13.453.0 — Toda alta/edición/baja de cuenta queda registrada en la bitácora
 * del sistema (módulo `tesoreria`): son datos que afectan saldos y conciliación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { primeraFila } from "@/lib/supabase/primeraFila";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import { registrarActividad } from "@/services/bitacora/registrar";

export type CuentaBancaria = Tables<"cuentas_bancarias">;

// v13.56.1 — Columnas explícitas (evita SELECT * en tablas financieras).
const CUENTA_BANCARIA_COLUMNS =
  "id, organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, fecha_saldo_inicial, activa, notas, created_at, updated_at, deleted_at, deleted_by";

function etiquetaCuentaBitacora(cuenta: Pick<CuentaBancaria, "banco" | "alias" | "moneda">): string {
  return [cuenta.alias || cuenta.banco, cuenta.moneda].filter(Boolean).join(" · ");
}

export async function listarCuentas(activas = true): Promise<CuentaBancaria[]> {
  // FIX BL-10: las cuentas eliminadas nunca se listan aquí; `activas` es filtro adicional.
  let q = supabase.from("cuentas_bancarias").select(CUENTA_BANCARIA_COLUMNS).is("deleted_at", null).order("alias", { ascending: true });
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

/**
 * H5 (Ola 4): `expectedUpdatedAt` es el `updated_at` leído al abrir el
 * formulario. Si otro usuario ya guardó, el UPDATE no toca filas y se avisa en
 * vez de sobrescribir sus cambios.
 */
export async function actualizarCuenta(
  id: string,
  patch: TablesUpdate<"cuentas_bancarias">,
  expectedUpdatedAt?: string | null,
): Promise<CuentaBancaria> {
  let query = supabase.from("cuentas_bancarias").update(patch).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const filas = primeraFila((await unwrap(query.select())) as CuentaBancaria[] | null);
  if (!filas) {
    if (expectedUpdatedAt) throw conflictoConcurrenciaError();
    throw new Error("No se guardaron los cambios: la cuenta ya no existe o no tienes permiso.");
  }
  const cuenta = filas;
  await registrarActividad({
    modulo: "tesoreria",
    accion: "editar_cuenta_bancaria",
    entidadId: id,
    entidadNombre: etiquetaCuentaBitacora(cuenta),
    detalles: { campos: Object.keys(patch), valores: patch as Record<string, unknown> },
  });
  return cuenta;
}

/**
 * ¿La cuenta ya tiene movimientos bancarios registrados?
 * Se usa para bloquear el cambio de moneda al editar (evita mezclar divisas
 * en saldos ya conciliados).
 */
export async function cuentaTieneMovimientos(id: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("bbva_movimientos")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_bancaria_id", id)
    .is("deleted_at", null);
  if (error) throw error;
  return (count ?? 0) > 0;
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

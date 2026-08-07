/**
 * Movimiento bancario derivado de un cobro de factura de venta (v13.451.0).
 *
 * Simétrico a `cxp/services/pagoProveedorMovimiento.ts`: cuando el usuario
 * indica en qué cuenta entró el dinero, se registra el **abono** conciliado en
 * `bbva_movimientos` para que el saldo del banco suba.
 *
 * Nunca lanza: el cobro ya quedó guardado y no queremos revertirlo por un
 * fallo al registrar el movimiento.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { cargoEnMonedaCuenta } from "@/features/cxp/services/pagoProveedorMovimiento";

export interface MovimientoCobroInput {
  pagoId: string;
  facturaId: string;
  cuentaBancariaId: string;
  fechaPago: string;
  monto: number;
  moneda: "MXN" | "USD" | "EUR";
  /** TC MXN por 1 USD, para convertir cuando la cuenta usa otra moneda. */
  tipoCambioUsd: number | null;
  referencia?: string;
  userId: string | null;
}

async function contextoFactura(
  facturaId: string,
): Promise<{ organizationId: string | null; concepto: string }> {
  const { data } = await supabase
    .from("facturas")
    .select("organization_id, numero, cliente_nombre")
    .eq("id", facturaId)
    .maybeSingle();
  const folio = data?.numero ?? "s/folio";
  const nombre = data?.cliente_nombre || "cliente";
  return {
    organizationId: data?.organization_id ?? null,
    concepto: `Cobro factura ${folio} — ${nombre}`,
  };
}

async function monedaDeCuenta(cuentaId: string): Promise<string | null> {
  const { data } = await supabase
    .from("cuentas_bancarias")
    .select("moneda")
    .eq("id", cuentaId)
    .maybeSingle();
  return data?.moneda ?? null;
}

/** `true` si ya existe un movimiento vivo ligado a este cobro (evita duplicar). */
async function yaExiste(pagoId: string): Promise<boolean> {
  const { data } = await supabase
    .from("bbva_movimientos")
    .select("id")
    .eq("pago_factura_id", pagoId)
    .is("deleted_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Inserta el abono bancario del cobro. Devuelve `true` si se creó. */
export async function crearMovimientoBancarioCobro(
  input: MovimientoCobroInput,
): Promise<boolean> {
  if (await yaExiste(input.pagoId)) return false;
  const [ctx, monedaCuenta] = await Promise.all([
    contextoFactura(input.facturaId),
    monedaDeCuenta(input.cuentaBancariaId),
  ]);
  if (!ctx.organizationId) return false;

  const payload: TablesInsert<"bbva_movimientos"> = {
    organization_id: ctx.organizationId,
    cuenta_bancaria_id: input.cuentaBancariaId,
    fecha: input.fechaPago,
    concepto: ctx.concepto,
    referencia: input.referencia ?? "",
    cargo: 0,
    abono: cargoEnMonedaCuenta(input.monto, input.moneda, monedaCuenta, input.tipoCambioUsd),
    hash_dedupe: `cobro-${input.pagoId}`,
    estado_conciliacion: "Conciliado",
    pago_factura_id: input.pagoId,
    conciliado_por: input.userId,
    conciliado_at: new Date().toISOString(),
    importado_por: input.userId,
  };
  const { error } = await supabase.from("bbva_movimientos").insert(payload);
  return !error;
}

/** Baja lógica del movimiento vinculado cuando se elimina el cobro. */
export async function eliminarMovimientoBancarioCobro(
  pagoId: string,
  userId: string | null,
): Promise<void> {
  await supabase
    .from("bbva_movimientos")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("pago_factura_id", pagoId)
    .eq("hash_dedupe", `cobro-${pagoId}`)
    .is("deleted_at", null);
}

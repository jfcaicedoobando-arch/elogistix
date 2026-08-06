/**
 * R6-N1 — Movimiento bancario derivado de un pago a proveedor.
 *
 * Antes el pago sólo se guardaba en `pagos_proveedor`, así que el saldo de la
 * cuenta en /tesoreria nunca bajaba. Aquí creamos (y damos de baja) el
 * movimiento en `bbva_movimientos` vinculado por `pago_proveedor_id`.
 *
 * OJO: el trigger `assert_movimiento_pago_consistente` exige que el movimiento
 * y el pago compartan `organization_id`; siempre usamos la org de la factura.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export interface MovimientoPagoInput {
  pagoId: string;
  organizationId: string;
  cuentaBancariaId: string;
  facturaId: string;
  fechaPago: string;
  monto: number;
  moneda: "MXN" | "USD" | "EUR";
  tipoCambioUsd: number | null;
  referencia?: string;
  userId: string | null;
}

/**
 * Cargo expresado en MXN. Se conserva sólo para la bitácora (`cargo_mxn`),
 * NUNCA para el movimiento bancario: ver `cargoEnMonedaCuenta`.
 */
export function cargoEnMxn(
  monto: number,
  moneda: string,
  tipoCambioUsd: number | null,
): number {
  if (moneda === "MXN") return monto;
  if (tipoCambioUsd && tipoCambioUsd > 0) return monto * tipoCambioUsd;
  return monto;
}

/**
 * v13.444.2 — El movimiento bancario SIEMPRE se registra en la moneda de la
 * cuenta. Antes se convertía todo a MXN, así que un pago de 23,650 USD desde
 * una cuenta en USD entraba como 406,938.45 y descuadraba el saldo.
 * Sólo se convierte cuando pago y cuenta difieren de verdad.
 */
export function cargoEnMonedaCuenta(
  monto: number,
  monedaPago: string,
  monedaCuenta: string | null,
  tipoCambioUsd: number | null,
): number {
  if (!monedaCuenta || monedaCuenta === monedaPago) return monto;
  const tc = tipoCambioUsd && tipoCambioUsd > 0 ? tipoCambioUsd : null;
  if (!tc) return monto;
  if (monedaPago === "USD" && monedaCuenta === "MXN") return monto * tc;
  if (monedaPago === "MXN" && monedaCuenta === "USD") return monto / tc;
  return monto;
}

async function monedaDeCuenta(cuentaId: string): Promise<string | null> {
  const { data } = await supabase
    .from("cuentas_bancarias")
    .select("moneda")
    .eq("id", cuentaId)
    .maybeSingle();
  return data?.moneda ?? null;
}

async function describirFactura(facturaId: string): Promise<string> {
  const { data } = await supabase
    .from("proveedor_facturas")
    .select("folio_proveedor, folio_interno, proveedores(nombre)")
    .eq("id", facturaId)
    .maybeSingle();
  const folio = data?.folio_proveedor || data?.folio_interno || "s/folio";
  // SAFE-CAST: embed 1-1 validado por el FK proveedor_facturas.proveedor_id.
  const prov = (data as { proveedores?: { nombre?: string | null } | null } | null)?.proveedores;
  const nombre = prov?.nombre ?? "proveedor";
  return `Pago prov. ${folio} — ${nombre}`;
}


/**
 * Inserta el movimiento bancario conciliado del pago. No lanza: el pago ya
 * quedó guardado y no queremos revertirlo por un fallo del movimiento.
 * Devuelve `true` si el movimiento se creó.
 */
export async function crearMovimientoBancarioPago(
  input: MovimientoPagoInput,
): Promise<boolean> {
  const concepto = await describirFactura(input.facturaId);
  const payload: TablesInsert<"bbva_movimientos"> = {
    organization_id: input.organizationId,
    cuenta_bancaria_id: input.cuentaBancariaId,
    fecha: input.fechaPago,
    concepto,
    referencia: input.referencia ?? "",
    cargo: cargoEnMxn(input.monto, input.moneda, input.tipoCambioUsd),
    abono: 0,
    hash_dedupe: `pago-${input.pagoId}`,
    estado_conciliacion: "Conciliado",
    pago_proveedor_id: input.pagoId,
    conciliado_por: input.userId,
    conciliado_at: new Date().toISOString(),
    importado_por: input.userId,
  };
  const { error } = await supabase.from("bbva_movimientos").insert(payload);
  return !error;
}

/** Soft-delete del movimiento vinculado cuando se elimina el pago. */
export async function eliminarMovimientoBancarioPago(
  pagoId: string,
  userId: string | null,
): Promise<void> {
  await supabase
    .from("bbva_movimientos")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("pago_proveedor_id", pagoId)
    .is("deleted_at", null);
}

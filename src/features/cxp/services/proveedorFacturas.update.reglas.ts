/**
 * Reglas de negocio de la edición de facturas de proveedor.
 * Extraído de `proveedorFacturas.update.ts` (Power of 10 #4: ≤200 líneas).
 */
import type { ProveedorFacturaRow } from "./proveedorFacturas";
import type { ActualizarFacturaPayload } from "./proveedorFacturas.update.types";
import { fetchSaldosProveedorFacturas } from "./saldosProveedorFactura";
import { roundMoney } from "@/lib/financial/financialUtils";
import { supabase } from "@/integrations/supabase/client";
import Decimal from "decimal.js";

export class SaldoNegativoError extends Error {
  code = "SALDO_NEGATIVO" as const;
  totalPagado: number;
  constructor(totalPagado: number) {
    super("El nuevo total no puede ser menor a lo ya pagado");
    this.totalPagado = totalPagado;
  }
}

/** Campos cuyo cambio fuerza re-aprobación si la factura estaba aprobada. */
const CAMPOS_SENSIBLES: Array<keyof ActualizarFacturaPayload> = [
  "folio_proveedor", "fecha_emision",
  "moneda", "tipo_cambio_usd",
  "subtotal", "iva", "ieps", "retenciones",
];

export type FacturaCamposSensibles = Pick<
  ProveedorFacturaRow,
  "folio_proveedor" | "fecha_emision" | "moneda" | "tipo_cambio_usd" | "subtotal" | "iva" | "ieps" | "retenciones"
>;

export function detectarCambioSensible(
  actual: FacturaCamposSensibles,
  payload: ActualizarFacturaPayload,
): boolean {
  return CAMPOS_SENSIBLES.some((k) => {
    // SAFE-CAST: lectura indexada por key tipada de objetos planos.
    const a = (actual as unknown as Record<string, unknown>)[k];
    // SAFE-CAST: lectura indexada por key tipada de objetos planos.
    const b = (payload as unknown as Record<string, unknown>)[k];
    if (typeof a === "number" || typeof b === "number") {
      // BL-12: `null`/`undefined`/"" son el mismo "sin capturar"; sin esto
      // `Number(null)=0` vs `Number(undefined)=NaN` disparaba re-aprobaciones
      // espurias al guardar sin cambiar nada.
      const na = a == null || a === "" ? null : Number(a);
      const nb = b == null || b === "" ? null : Number(b);
      if (na === null || nb === null) return na !== nb;
      const precision = k === "tipo_cambio_usd" ? 4 : 2;
      return new Decimal(na).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP)
        .equals(new Decimal(nb).toDecimalPlaces(precision, Decimal.ROUND_HALF_UP)) === false;
    }
    return (a ?? null) !== (b ?? null);
  });
}

/** Total = Subtotal + IVA + IEPS − Retenciones (BL-11: redondeado a centavos). */
export function calcularTotal(payload: ActualizarFacturaPayload): number {
  return roundMoney(
    (Number(payload.subtotal) || 0) +
      (Number(payload.iva) || 0) +
      (Number(payload.ieps) || 0) -
      (Number(payload.retenciones) || 0),
  );
}

/** Pagos y NC aplicadas en moneda de factura según la vista canónica con RLS.
 * Excluye borrados/NC sin aplicar y conserva la tolerancia de un centavo.
 */
export async function validarTotalNoMenorAPagado(id: string, nuevoTotal: number): Promise<void> {
  const saldo = (await fetchSaldosProveedorFacturas([id])).get(id);
  if (!saldo) throw new Error("No se pudo verificar el saldo de la factura. Recarga e intenta de nuevo.");
  const totalPagado = saldo.pagado + saldo.notas_credito;
  if (nuevoTotal + 0.01 < totalPagado) throw new SaldoNegativoError(totalPagado);
}

/** Una moneda nueva requiere reprocesar aplicaciones; no se reescribe el pasado. */
export class CambioMonedaConAplicacionesError extends Error {
  code = "CAMBIO_MONEDA_CON_APLICACIONES" as const;
  constructor() {
    super("No se puede cambiar la moneda de una factura con pagos o notas de crédito aplicadas. Conserva la moneda actual.");
  }
}

export async function validarCambioMonedaSinAplicaciones(id: string): Promise<void> {
  const { data: pagos, error: errorPagos } = await supabase.from("pagos_proveedor")
    .select("id").eq("proveedor_factura_id", id).is("deleted_at", null).limit(1);
  if (errorPagos) throw errorPagos;
  const { data: notas, error: errorNotas } = await supabase.from("proveedor_notas_credito")
    .select("id").eq("proveedor_factura_id", id).eq("estado", "Aplicada").is("deleted_at", null).limit(1);
  if (errorNotas) throw errorNotas;
  if (pagos?.length || notas?.length) throw new CambioMonedaConAplicacionesError();
}

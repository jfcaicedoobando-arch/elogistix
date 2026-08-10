/**
 * Reglas de negocio de la edición de facturas de proveedor.
 * Extraído de `proveedorFacturas.update.ts` (Power of 10 #4: ≤200 líneas).
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProveedorFacturaRow } from "./proveedorFacturas";
import type { ActualizarFacturaPayload } from "./proveedorFacturas.update.types";

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
    if (typeof a === "number" || typeof b === "number") return Number(a) !== Number(b);
    return a !== b;
  });
}

/** Total = Subtotal + IVA + IEPS − Retenciones. */
export function calcularTotal(payload: ActualizarFacturaPayload): number {
  return (
    (Number(payload.subtotal) || 0) +
    (Number(payload.iva) || 0) +
    (Number(payload.ieps) || 0) -
    (Number(payload.retenciones) || 0)
  );
}

/**
 * Ola 9 · A6: ignora pagos borrados (soft-delete) y descuenta las notas de
 * crédito aplicadas; si no, el "total pagado" se infla y bloquea ediciones
 * legítimas. Tolerancia de 1 centavo por redondeos.
 * RG4 (Ola 3): los pagos se suman en la MONEDA DE LA FACTURA
 * (`monto_en_moneda_factura`), igual que el listado; sumar `monto` crudo
 * inflaba ~17× cuando la factura es USD y el pago se hizo en MXN.
 */
export async function validarTotalNoMenorAPagado(id: string, nuevoTotal: number): Promise<void> {
  const { data: pagos, error: errPagos } = await supabase
    .from("pagos_proveedor")
    .select("monto, monto_en_moneda_factura, deleted_at")
    .eq("proveedor_factura_id", id)
    .is("deleted_at", null);
  if (errPagos) throw errPagos;
  const { data: notas, error: errNotas } = await supabase
    .from("proveedor_notas_credito")
    .select("monto")
    .eq("proveedor_factura_id", id)
    .in("estado", ["Aplicada"])
    .is("deleted_at", null);
  if (errNotas) throw errNotas;
  const totalNotas = (notas ?? []).reduce((acc, n) => acc + (Number(n.monto) || 0), 0);
  const totalPagado = sumarPagosEnMonedaFactura(pagos ?? []) + totalNotas;
  if (nuevoTotal + 0.01 < totalPagado) throw new SaldoNegativoError(totalPagado);
}

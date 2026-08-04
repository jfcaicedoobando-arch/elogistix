/**
 * Tope de vinculación: la suma de montos asignados a conceptos de costo de
 * embarque no puede exceder el **subtotal** de la factura de proveedor
 * (los conceptos de costo se registran sin impuestos).
 *
 * Se usa como candado del modal "Capturar factura de proveedor" para evitar
 * que una factura de menor valor "cubra" costos por un importe mayor.
 */
import currency from "currency.js";

const TOLERANCIA = 0.01;

export interface LineaVinculada {
  monto?: number | string | null;
  montoOriginal?: number | string | null;
}

export interface ResultadoTopeVinculacion {
  /** Suma de los montos vinculados. */
  asignado: number;
  /** subtotal − asignado (nunca negativo; 0 cuando ya se excedió). */
  disponible: number;
  /** asignado − subtotal cuando es positivo; 0 en caso contrario. */
  excedente: number;
  /** `true` sólo si el excedente supera la tolerancia de 0.01. */
  excede: boolean;
  /** Número de conceptos vinculados. */
  lineas: number;
}

export function sumarVinculos(vinculos: Record<string, LineaVinculada>): number {
  return Object.values(vinculos).reduce(
    (acc, v) => currency(acc, { precision: 4 }).add(Number(v.monto) || 0).value,
    0,
  );
}

export function calcularTopeVinculacion(
  subtotal: number,
  vinculos: Record<string, LineaVinculada>,
): ResultadoTopeVinculacion {
  const asignado = sumarVinculos(vinculos);
  const diferencia = currency(subtotal || 0, { precision: 4 }).subtract(asignado).value;
  const excedente = diferencia < 0 ? Math.abs(diferencia) : 0;
  return {
    asignado,
    disponible: diferencia > 0 ? diferencia : 0,
    excedente,
    excede: excedente > TOLERANCIA,
    lineas: Object.keys(vinculos).length,
  };
}

/** `true` si el monto capturado en la línea supera el monto cotizado del concepto. */
export function lineaExcedeOriginal(linea: LineaVinculada): boolean {
  const original = Number(linea.montoOriginal);
  if (!Number.isFinite(original) || original <= 0) return false;
  return (Number(linea.monto) || 0) - original > TOLERANCIA;
}

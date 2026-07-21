/**
 * Helper puro para calcular el cuadre entre el subtotal de una factura de
 * proveedor y la suma neta de sus conceptos.
 *
 * Se usa en la UI de captura (`DialogNuevaFacturaProveedor`) para dar
 * feedback en vivo antes de que el trigger `_cxp_validar_aprobacion`
 * dispare `LC_CXP_DESCUADRE` al aprobar.
 *
 * Regla replicada del trigger:
 *   suma = Σ (monto × COALESCE(NULLIF(cantidad,0),1))
 *   cuadra si |subtotal − suma| ≤ 0.01
 */
import currency from "currency.js";

export type EstadoCuadre = "cuadrado" | "faltante" | "sobrante" | "sin_conceptos";

export interface ConceptoParaCuadre {
  monto: number;
  cantidad?: number | null;
}

export interface ResultadoCuadre {
  suma: number;
  diferencia: number; // subtotal − suma (positivo = falta, negativo = sobra)
  estado: EstadoCuadre;
  puedeAprobar: boolean;
}

const TOLERANCIA = 0.01;

/** Suma neta de conceptos usando `currency.js` para evitar drift binario. */
export function sumarConceptos(conceptos: ReadonlyArray<ConceptoParaCuadre>): number {
  return conceptos.reduce((acc, c) => {
    const cantidad = c.cantidad && c.cantidad !== 0 ? c.cantidad : 1;
    const linea = currency(c.monto, { precision: 4 }).multiply(cantidad);
    return currency(acc, { precision: 4 }).add(linea).value;
  }, 0);
}

export function calcularCuadreConceptos(
  subtotal: number,
  conceptos: ReadonlyArray<ConceptoParaCuadre>,
): ResultadoCuadre {
  const suma = sumarConceptos(conceptos);
  const diferencia = currency(subtotal, { precision: 4 }).subtract(suma).value;
  const abs = Math.abs(diferencia);

  if (conceptos.length === 0) {
    return { suma: 0, diferencia: subtotal, estado: "sin_conceptos", puedeAprobar: false };
  }
  if (abs <= TOLERANCIA) {
    return { suma, diferencia: 0, estado: "cuadrado", puedeAprobar: true };
  }
  return {
    suma,
    diferencia,
    estado: diferencia > 0 ? "faltante" : "sobrante",
    puedeAprobar: false,
  };
}

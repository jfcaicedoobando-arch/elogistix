/** Contrato de captura/persistencia CxP: importes a centavos, cantidades a 6 decimales. */
import type { CfdiConceptoParsed } from "../services/parseCfdi.types";
import { parseNumeroFiscal, parseImporteFiscal } from "@/lib/domain/facturaConceptos";
import { roundMoney } from "@/lib/financial/financialUtils";
import { sumarConceptos, type ConceptoParaCuadre, type ResultadoCuadre } from "./cuadreConceptos";

/** Cero tras redondear sigue siendo inválido; nunca se reconvierte en una unidad. */
export function normalizarCantidadCaptura(value: unknown): number {
  return Math.round((parseNumeroFiscal(value) ?? 1) * 1e6) / 1e6;
}

export function cantidadesCapturaValidas(conceptos: ReadonlyArray<{ cantidad?: number | null }>): boolean {
  return conceptos.every((c) => normalizarCantidadCaptura(c.cantidad) > 0);
}

/** La misma representación debe alimentar editor, propuesta y filas guardadas. */
export function normalizarConceptoPersistible<T extends CfdiConceptoParsed>(c: T): T {
  return { ...c, cantidad: normalizarCantidadCaptura(c.cantidad), importe: parseImporteFiscal(c.importe),
    iva: parseImporteFiscal(c.iva), ieps: parseImporteFiscal(c.ieps) };
}

/**
 * En capturas nuevas ya normalizadas no aplica la tolerancia histórica por
 * unidad: permitir 0.005 × cantidad escondería una pérdida de precisión.
 */
export function calcularCuadreCaptura(
  subtotal: number,
  conceptos: ReadonlyArray<ConceptoParaCuadre>,
): ResultadoCuadre {
  const normalizados = conceptos.map((c) => ({
    monto: parseImporteFiscal(c.monto), cantidad: normalizarCantidadCaptura(c.cantidad),
  }));
  const suma = roundMoney(sumarConceptos(normalizados.filter((c) => c.cantidad > 0)));
  const diferencia = roundMoney(subtotal - suma);
  if (!conceptos.length) return { suma, diferencia, estado: "sin_conceptos", puedeAprobar: false };
  const cuadra = cantidadesCapturaValidas(normalizados) && Math.abs(diferencia) <= 0.01;
  return { suma, diferencia: cuadra ? 0 : diferencia,
    estado: cuadra ? "cuadrado" : diferencia > 0 ? "faltante" : "sobrante", puedeAprobar: cuadra };
}

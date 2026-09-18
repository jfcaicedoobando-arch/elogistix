/**
 * P1 · Auditoría fiscal — preflight de CUADRE entre los renglones vigentes y la
 * cabecera guardada de la factura, ANTES de llamar al PAC.
 *
 * Se recalcula por concepto (importe, IVA trasladado según su tratamiento
 * declarado, retenciones de IVA/ISR) con el mismo redondeo monetario a dos
 * decimales que usa el payload, y se compara con `subtotal`, `iva` y `total`
 * de la cabecera. Si están desincronizados NO se timbra: no se "ajusta" ningún
 * tratamiento fiscal para hacer cuadrar los números.
 */

export interface ConceptoCuadre {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  tipo_iva?: string | null;
  tasa_iva?: number | null;
  tasa_ret_isr?: number | null;
  tasa_ret_iva?: number | null;
}

export interface TotalesCuadre {
  subtotal: number;
  iva_trasladado: number;
  ret_iva: number;
  ret_isr: number;
  total: number;
}

export interface CabeceraCuadre {
  subtotal?: number | string | null;
  iva?: number | string | null;
  total?: number | string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Los tratamientos que no causan IVA trasladado no suman impuesto alguno. */
function causaIva(tipo: string | null | undefined): boolean {
  return tipo === "gravado_16" || tipo === "gravado_8";
}

/**
 * Tolerancia justificada: un centavo por renglón (acumulación del redondeo
 * monetario por concepto), con piso de un centavo.
 */
export function toleranciaCentavos(numConceptos: number): number {
  return round2(Math.max(1, numConceptos) * 0.01);
}

export function recalcularTotalesConceptos(conceptos: ConceptoCuadre[]): TotalesCuadre {
  let subtotal = 0;
  let iva = 0;
  let retIva = 0;
  let retIsr = 0;
  for (const c of conceptos) {
    const importe = round2(Number(c.cantidad) * Number(c.precio_unitario));
    subtotal = round2(subtotal + importe);
    if (causaIva(c.tipo_iva)) {
      iva = round2(iva + round2(importe * Number(c.tasa_iva ?? 0)));
    }
    const rIva = Number(c.tasa_ret_iva ?? 0);
    const rIsr = Number(c.tasa_ret_isr ?? 0);
    if (rIva > 0) retIva = round2(retIva + round2(importe * rIva));
    if (rIsr > 0) retIsr = round2(retIsr + round2(importe * rIsr));
  }
  const total = round2(subtotal + iva - retIva - retIsr);
  return { subtotal, iva_trasladado: iva, ret_iva: retIva, ret_isr: retIsr, total };
}

function numeroCabecera(valor: number | string | null | undefined): number | null {
  if (valor == null) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function diferencia(
  etiqueta: string,
  calculado: number,
  header: number | null,
  tolerancia: number,
): string | null {
  if (header === null) return null;
  // EPSILON: la resta de flotantes deja basura (0.020000000000000018); sin este
  // margen un descuadre exacto de 2 centavos se vería como 2.0000000000001.
  const EPSILON = 1e-9;
  if (Math.abs(calculado - header) - tolerancia <= EPSILON) return null;
  return `${etiqueta}: los conceptos dan ${calculado.toFixed(2)} y la factura tiene ${header.toFixed(2)}`;
}

/**
 * Lista de descuadres accionables (vacía = cuadra). La moneda no cambia la
 * aritmética: todo se compara en la moneda de la factura, sin convertir.
 */
export function diferenciasCuadreFiscal(
  conceptos: ConceptoCuadre[],
  cabecera: CabeceraCuadre,
): string[] {
  const t = recalcularTotalesConceptos(conceptos);
  const tol = toleranciaCentavos(conceptos.length);
  const detalles: string[] = [];
  const subtotal = diferencia("Subtotal", t.subtotal, numeroCabecera(cabecera.subtotal), tol);
  const iva = diferencia("IVA trasladado", t.iva_trasladado, numeroCabecera(cabecera.iva), tol);
  // El total incluye retenciones (subtotal + IVA − retenciones), así que un
  // descuadre aquí también delata retenciones no reflejadas en la cabecera.
  const total = diferencia("Total", t.total, numeroCabecera(cabecera.total), tol);
  for (const d of [subtotal, iva, total]) if (d) detalles.push(d);
  return detalles;
}

/**
 * B9 (v13.823.151 / v13.823.152) — La proforma se marca
 * `estado_proforma = 'facturada'` en cuanto se convierte, aunque la factura
 * resultante siga en Borrador o en "Por timbrar". Eso contradecía al resumen
 * del embarque, al stepper y a la tabla de facturas.
 *
 * Este helper es SÓLO de presentación: no cambia estados en base de datos ni el
 * candado anti-doble conversión (`factura_id` sigue siendo la verdad).
 */

export interface FacturaCicloLite {
  estado: string | null | undefined;
  uuid_fiscal?: string | null;
}

/**
 * Estados previos a la emisión (preparación interna del documento).
 * Coinciden con los pasos "Borrador" y "Por timbrar" del ciclo documental
 * (`documentoEstados.ts`) y con el enum `estado_factura`.
 */
const ESTADOS_PREPARACION = new Set(["borrador", "por timbrar"]);

/**
 * Estados que sólo existen una vez emitida la factura. Se enumeran de forma
 * explícita: un estado desconocido NO se asume emitido.
 */
const ESTADOS_EMITIDOS = new Set([
  "emitida",
  "parcialmente pagada",
  "pagada",
  "vencida",
  "cancelada",
  "sustituida",
]);

const normalizar = (f: FacturaCicloLite): string => (f.estado ?? "").trim().toLowerCase();

/** Una factura cuenta como emitida sólo en estados posteriores a la preparación. */
export function facturaEmitida(f: FacturaCicloLite): boolean {
  return ESTADOS_EMITIDOS.has(normalizar(f));
}

/** true cuando la factura existe pero aún no se emite (Borrador / Por timbrar). */
export function facturaEnPreparacion(f: FacturaCicloLite): boolean {
  return ESTADOS_PREPARACION.has(normalizar(f));
}

export function contarFacturasEmitidas(facturas: FacturaCicloLite[]): number {
  return facturas.filter(facturaEmitida).length;
}

/**
 * Etiqueta del ciclo para una proforma ya convertida.
 * - Sin facturas conocidas → se mantiene "Facturada" (no se oculta el estado).
 * - Alguna emitida → "Facturada".
 * - Sólo en preparación → distingue borrador de "por timbrar".
 */
export function etiquetaProformaConvertida(facturas: FacturaCicloLite[]): string {
  if (facturas.length === 0) return "Facturada";
  if (contarFacturasEmitidas(facturas) > 0) return "Facturada";
  const porTimbrar = facturas.some((f) => normalizar(f) === "por timbrar");
  return porTimbrar ? "Convertida, por timbrar" : "Convertida a borrador";
}

/**
 * Derivados puros de la captura de factura de proveedor. Viven fuera del
 * componente para bajar su complejidad ciclomática (regla Power of 10).
 */
import { abrirFacturaEntrante } from "@/features/cxp/services/facturasEntrantes";
import { notifyError } from "@/lib/ui/appFeedback";

export interface MontosCaptura {
  sub: number;
  iva: number;
  ieps: number;
  ret: number;
}

/** Normaliza a número los importes capturados (strings del formulario). */
export function derivarMontos(values: {
  subtotal: unknown; iva: unknown; ieps: unknown; retenciones: unknown;
}): MontosCaptura {
  return {
    sub: Number(values.subtotal) || 0,
    iva: Number(values.iva) || 0,
    ieps: Number(values.ieps) || 0,
    ret: Number(values.retenciones) || 0,
  };
}

/**
 * v13.819.3 — Conceptos con datos reales. Un renglón recién agregado (vacío y
 * en $0) NO cuenta como captura: agregarlo por error no debe disparar la
 * confirmación de descarte, y al cerrar se limpia para no acumular filas
 * vacías entre aperturas.
 */
export function conceptosConDatos(
  conceptos: ReadonlyArray<{ descripcion?: string | null; importe?: unknown; cantidad?: unknown }>,
): number {
  return conceptos.filter(
    (c) =>
      (c.descripcion ?? "").trim().length > 0 ||
      (Number(c.importe) || 0) !== 0,
  ).length;
}

/** FE-11: ¿hay captura suficiente para advertir antes de cerrar/navegar? */
export function hayCapturaFactura(params: {
  provId?: string | null;
  folio?: string | null;
  subtotal: number;
  conceptos: number;
}): boolean {
  return Boolean(params.provId) || params.subtotal > 0 ||
    Boolean(params.folio) || params.conceptos > 0;
}

/** Abre el archivo del buzón notificando el error de forma uniforme. */
export async function verArchivoBuzon(path: string, nombre: string): Promise<void> {
  try {
    await abrirFacturaEntrante(path, nombre);
  } catch (error) {
    notifyError(undefined, {
      title: "No se pudo abrir el archivo del buzón",
      error,
      method: "ABRIR_FACTURA_ENTRANTE_CAPTURA",
    });
  }
}

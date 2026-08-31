/**
 * Helpers puros de facturas manuales: vencimiento, tasa de IVA por renglón,
 * folio borrador y construcción/validación de líneas.
 *
 * Extraído de `facturaManual.ts` (límite Power-of-10 de 200 líneas).
 */
import { subtotalLinea } from "@/lib/financial/financialUtils";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";
import { TASA_IVA_FRONTERA } from "@/features/facturacion/services/conceptosFacturaShared";
import { addDaysIso } from "@/lib/date/dateOnly";
import { parseCantidadFiscal } from "@/lib/domain/facturaConceptos";

export interface ConceptoManualInput {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  clave_sat?: string;
  tipo_iva?: TipoIvaConcepto;
}

export interface LineaManual {
  idx: number;
  descripcion: string;
  cantidad: number;
  precio: number;
  totalLinea: number;
  ivaLinea: number;
  tipo_iva: TipoIvaConcepto;
  tasaFila: number | null;
  clave: string;
}

/**
 * BL-2 — el vencimiento se calcula con el canon `addDaysIso` (espejo exacto de
 * `fecha_emision + dias_credito` en Postgres). El `addDays` local anterior
 * mezclaba medianoche del navegador con formateo en America/Mexico_City y en
 * navegadores fuera de CDMX devolvía el día anterior.
 */
export function vencimiento(yyyyMmDd: string, days: number): string {
  const iso = addDaysIso(yyyyMmDd, days);
  if (!iso) throw new Error(`Fecha de emisión inválida (${yyyyMmDd}) o días de crédito inválidos (${days}).`);
  return iso;
}

export function tasaAplicada(tipo: TipoIvaConcepto | undefined, tasaGlobal: number): number | null {
  const t = tipo ?? "gravado_16";
  if (t === "gravado_16") return tasaGlobal;
  if (t === "gravado_8") return TASA_IVA_FRONTERA;
  if (t === "tasa_0") return 0;
  return null; // exento
}

/**
 * FIX-17 — folio borrador con entropía (Date + UUID) para evitar colisión
 * bajo carga concurrente. El prefijo `BORRADOR-` sigue siendo el marcador
 * que la UI usa para bloquear envío/descarga hasta el timbrado.
 */
export function generarFolioBorrador(): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `BORRADOR-${Date.now().toString(36)}-${rand}`;
}

/**
 * FIX-17 — valida cada concepto ANTES de tocar la BD y computa los totales de
 * línea con `subtotalLinea` para que el encabezado sea Σ exacto al centavo.
 */
export function construirLineasManuales(
  conceptos: ConceptoManualInput[],
  tasa: number,
): LineaManual[] {
  return conceptos.map((c, idx) => {
    const cantidad = Number(c.cantidad);
    const precio = Number(c.precio_unitario);
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`Concepto #${idx + 1} ("${c.descripcion || "sin descripción"}"): cantidad inválida (${c.cantidad}). Debe ser un número mayor a 0.`);
    }
    if (!Number.isFinite(precio) || precio < 0) {
      throw new Error(`Concepto #${idx + 1} ("${c.descripcion || "sin descripción"}"): precio_unitario inválido (${c.precio_unitario}). Debe ser un número finito ≥ 0.`);
    }
    // BL-1 — se conservan decimales (1.5 ton se timbra como 1.5, no como 2).
    // Misma normalización fiscal que la ruta de `conceptosFacturaCrud`.
    const cantidadFiscal = parseCantidadFiscal(cantidad);
    const totalLinea = subtotalLinea(cantidadFiscal, precio);
    const tipo_iva: TipoIvaConcepto = c.tipo_iva ?? "gravado_16";
    const tasaFila = tasaAplicada(tipo_iva, tasa);
    const ivaLinea = tasaFila != null ? subtotalLinea(totalLinea, tasaFila) : 0;
    // α.1 — clave SAT obligatoria; se elimina el fallback silencioso "81141601".
    const clave = c.clave_sat?.trim();
    if (!clave) {
      throw new Error(`El concepto #${idx + 1} ("${c.descripcion || "sin descripción"}") no tiene clave SAT. Selecciona la clave correcta del catálogo SAT antes de crear la factura.`);
    }
    return { idx, descripcion: c.descripcion, cantidad: cantidadFiscal, precio, totalLinea, ivaLinea, tipo_iva, tasaFila, clave };
  });
}

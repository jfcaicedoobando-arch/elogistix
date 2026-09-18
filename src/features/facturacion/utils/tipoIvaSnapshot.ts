/**
 * P2-IVA — Tratamiento fiscal de un renglón leído del snapshot de emisión
 * (borrador propio o respuesta de Facturapi).
 *
 * Antes cualquier tasa positiva se mostraba como 16% (un renglón al 8% de
 * frontera se veía como 16%) y, si no había traslado de IVA, se tomaba
 * `taxes[0]` — que puede ser una RETENCIÓN de ISR o de IVA.
 *
 * Reglas: se usa la tasa exacta, se ignoran los impuestos con `withholding`,
 * se respeta el factor `Exento` y `taxability`/ObjetoImp "01". Si el snapshot
 * no alcanza para saberlo, se devuelve `null` (la UI muestra "No disponible")
 * en vez de inventar un tratamiento.
 */
import { esTipoIvaSat, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";
import { TASA_IVA } from "@/lib/financial/financialUtils";

export interface ImpuestoSnapshot {
  type?: string;
  rate?: number;
  factor?: string;
  withholding?: boolean;
}

export interface LineaSnapshotIva {
  tipo_iva?: string | null;
  taxability?: string | null;
  product?: { taxes?: ImpuestoSnapshot[]; taxability?: string | null };
  taxes?: ImpuestoSnapshot[];
}

const EPS = 1e-6;

/** Tratamiento a partir de la tasa exacta del traslado (nunca se ancla). */
function tipoDesdeTasa(rate: number): TipoIvaSat | null {
  if (Math.abs(rate) < EPS) return "tasa_0";
  if (Math.abs(rate - 0.08) < EPS) return "gravado_8";
  if (Math.abs(rate - TASA_IVA) < EPS) return "gravado_16";
  return null; // Tasa fuera del catálogo: no se fuerza a 16%.
}

/** Primer traslado de IVA del snapshot (ignora retenciones), o `null`. */
function trasladoIva(linea: LineaSnapshotIva): ImpuestoSnapshot | null {
  const taxes = linea.product?.taxes ?? linea.taxes;
  if (!Array.isArray(taxes)) return null;
  const traslados = taxes.filter(
    (t) => !t?.withholding && String(t?.type ?? "").toUpperCase() === "IVA",
  );
  return traslados[0] ?? null;
}

/** Tratamiento del renglón, o `null` cuando el snapshot no permite saberlo. */
export function tipoIvaDesdeSnapshot(linea: LineaSnapshotIva): TipoIvaSat | null {
  // 1) El tipo explícito manda (incluye no objeto, que no se puede reconstruir).
  if (esTipoIvaSat(linea.tipo_iva)) return linea.tipo_iva;
  // 2) ObjetoImp 01 del CFDI (Facturapi lo expone como `taxability`).
  const taxability = String(linea.product?.taxability ?? linea.taxability ?? "").trim();
  if (taxability === "01") return "no_objeto";
  // 3) Traslados de IVA del snapshot: nunca retenciones.
  const iva = trasladoIva(linea);
  if (iva === null) return null;
  if (String(iva.factor ?? "").toLowerCase() === "exento") return "exento";
  const rate = Number(iva.rate ?? Number.NaN);
  return Number.isFinite(rate) ? tipoDesdeTasa(rate) : null;
}

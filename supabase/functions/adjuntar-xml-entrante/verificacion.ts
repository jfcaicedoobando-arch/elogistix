/**
 * Comparación pura entre los metadatos declarados por el cliente y los que el
 * servidor re-parsea del XML real (Ola 5 · O5.8 / BUG-18).
 *
 * Regla: los valores que se guardan son SIEMPRE los del servidor. Lo declarado
 * sólo se usa para detectar manipulación y rechazar la operación.
 */
import type { CfdiParsed } from "../_shared/cfdiParser.ts";

export interface MetaDeclarada {
  uuid?: string | null;
  rfcEmisor?: string | null;
  total?: number | null;
  moneda?: string | null;
}

export interface MetaServidor {
  uuid: string;
  rfcEmisor: string;
  folioSerie: string | null;
  fechaEmision: string | null;
  total: number;
  moneda: string;
}

/** Tolerancia de centavo para el total (redondeos del parser del navegador). */
const TOLERANCIA_TOTAL = 0.01;

export function metaDesdeCfdi(cfdi: CfdiParsed): MetaServidor {
  const folio = [cfdi.serie, cfdi.folio].filter((p) => p && p.trim()).join("-");
  return {
    uuid: cfdi.uuid.toUpperCase(),
    rfcEmisor: cfdi.emisor.rfc.toUpperCase(),
    folioSerie: folio || null,
    fechaEmision: cfdi.fecha || null,
    total: cfdi.total,
    moneda: (cfdi.moneda || "MXN").toUpperCase(),
  };
}

function norm(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim().toUpperCase();
  return v ? v : null;
}

/**
 * Devuelve la lista de discrepancias entre lo declarado y el XML real.
 * Los campos que el cliente no declaró no se comparan (no son manipulación).
 */
export function discrepanciasMeta(
  declarada: MetaDeclarada | null | undefined,
  servidor: MetaServidor,
): string[] {
  if (!declarada) return [];
  const fallos: string[] = [];
  const uuid = norm(declarada.uuid);
  if (uuid && uuid !== servidor.uuid) fallos.push("uuid_fiscal");
  const rfc = norm(declarada.rfcEmisor);
  if (rfc && rfc !== servidor.rfcEmisor) fallos.push("rfc_emisor");
  const moneda = norm(declarada.moneda);
  if (moneda && moneda !== servidor.moneda) fallos.push("moneda");
  if (
    typeof declarada.total === "number" &&
    Number.isFinite(declarada.total) &&
    Math.abs(declarada.total - servidor.total) > TOLERANCIA_TOTAL
  ) {
    fallos.push("total");
  }
  return fallos;
}

/** SHA-256 hex del contenido (misma llave de deduplicación que el cliente). */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

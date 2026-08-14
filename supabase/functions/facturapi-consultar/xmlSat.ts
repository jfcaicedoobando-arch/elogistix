/**
 * xmlSat — Descarga y lectura del XML real (CFDI 4.0) desde FacturApi + consulta
 * del estatus del comprobante en el servicio público del SAT.
 *
 * Se usa desde `facturapi-consultar` para que el botón "Verificar estatus en
 * FacturApi" del detalle de factura valide, en el mismo clic:
 *   1. El XML de la factura (UUID, RFCs, total, moneda, fecha).
 *   2. El XML de cada REP timbrado (incluidos los cancelados).
 *   3. El estatus real en el SAT (Vigente / Cancelado / No encontrado).
 *
 * El parseo es por expresión regular: en el runtime de edge no hay `DOMParser`
 * garantizado y sólo necesitamos atributos de tres nodos.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import { consultarSat, normalizarRfc, type EstatusSat } from "../_shared/satConsulta.ts";

const XML_FETCH_TIMEOUT_MS = 15_000;
/** Tolerancia de centavos al comparar importes XML vs. BD. */
const TOL_IMPORTE = 0.01;

export interface CfdiMeta {
  uuid: string | null;
  rfc_emisor: string | null;
  rfc_receptor: string | null;
  total: number | null;
  moneda: string | null;
  fecha: string | null;
  serie: string | null;
  folio: string | null;
}

export const CFDI_META_VACIO: CfdiMeta = {
  uuid: null,
  rfc_emisor: null,
  rfc_receptor: null,
  total: null,
  moneda: null,
  fecha: null,
  serie: null,
  folio: null,
};

/** Lee un atributo del nodo cuyo nombre local sea `nodo` (ignora prefijos). */
function attr(xml: string, nodo: string, atributo: string): string | null {
  const nodoRx = new RegExp(`<(?:[\\w.-]+:)?${nodo}\\b[^>]*>`, "i");
  const tag = nodoRx.exec(xml)?.[0];
  if (!tag) return null;
  const rx = new RegExp(`\\b${atributo}\\s*=\\s*"([^"]*)"`, "i");
  const val = rx.exec(tag)?.[1];
  return val && val.trim() ? val.trim() : null;
}

function num(valor: string | null): number | null {
  if (valor == null) return null;
  const n = Number(valor.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Extrae los metadatos fiscales del XML. Campos ausentes quedan en `null`. */
export function leerMetaCfdi(xml: string): CfdiMeta {
  if (!xml || !/Comprobante/i.test(xml)) return { ...CFDI_META_VACIO };
  const emisorRfc = attr(xml, "Emisor", "Rfc") ?? attr(xml, "Emisor", "rfc");
  const receptorRfc = attr(xml, "Receptor", "Rfc") ?? attr(xml, "Receptor", "rfc");
  const uuid = attr(xml, "TimbreFiscalDigital", "UUID");
  const fecha = attr(xml, "Comprobante", "Fecha");
  return {
    uuid: uuid ? uuid.toUpperCase() : null,
    rfc_emisor: emisorRfc ? normalizarRfc(emisorRfc) : null,
    rfc_receptor: receptorRfc ? normalizarRfc(receptorRfc) : null,
    total: num(attr(xml, "Comprobante", "Total")),
    moneda: attr(xml, "Comprobante", "Moneda")?.toUpperCase() ?? null,
    fecha: fecha ? fecha.slice(0, 19) : null,
    serie: attr(xml, "Comprobante", "Serie"),
    folio: attr(xml, "Comprobante", "Folio"),
  };
}

/**
 * Descarga el XML timbrado. En FacturApi tanto las facturas como los REP viven
 * bajo `/invoices/{id}/xml`.
 */
export async function descargarXml(apiKey: string, facturapiId: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), XML_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${FACTURAPI_BASE}/invoices/${facturapiId}/xml`, {
      headers: { Authorization: basicAuthHeader(apiKey) },
      signal: ctrl.signal,
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`FacturApi ${res.status}: ${texto.slice(0, 200)}`);
    return texto;
  } finally {
    clearTimeout(timer);
  }
}

/** Consulta el estatus en el SAT usando los datos leídos del XML. */
export async function verificarSat(meta: CfdiMeta): Promise<{ estatus: EstatusSat; raw: string }> {
  if (!meta.uuid || !meta.rfc_emisor || !meta.rfc_receptor || meta.total == null) {
    return { estatus: "No verificable", raw: "Faltan datos en el XML para armar la expresión impresa." };
  }
  try {
    return await consultarSat(meta.rfc_emisor, meta.rfc_receptor, meta.total, meta.uuid);
  } catch (err) {
    // Ola 14 · R5EF-03: el crudo (puede incluir slice de respuesta del PAC) sólo al log.
    console.error("facturapi-consultar descargarXml:", err instanceof Error ? err.message : err);
    return { estatus: "Error", raw: "" };
  }
}

function difImporte(etiqueta: string, xmlVal: number | null, bdVal: number | null): string | null {
  if (xmlVal == null || bdVal == null) return null;
  if (Math.abs(xmlVal - bdVal) <= TOL_IMPORTE) return null;
  return `${etiqueta}: XML=${xmlVal} ≠ BD=${bdVal}`;
}

function difTexto(etiqueta: string, xmlVal: string | null, bdVal: string | null): string | null {
  const a = (xmlVal ?? "").trim().toUpperCase();
  const b = (bdVal ?? "").trim().toUpperCase();
  if (!a || !b || a === b) return null;
  return `${etiqueta}: XML='${a}' ≠ BD='${b}'`;
}

export interface FacturaComparable {
  uuid_fiscal: string | null;
  total: number | null;
  moneda: string | null;
  rfc_cliente: string | null;
}

/** Diferencias entre el XML de la factura y lo guardado en Libre Carga. */
export function compararFacturaXml(meta: CfdiMeta, bd: FacturaComparable): string[] {
  return [
    difTexto("XML UUID", meta.uuid, bd.uuid_fiscal),
    difImporte("XML total", meta.total, bd.total),
    difTexto("XML moneda", meta.moneda, bd.moneda),
    difTexto("XML RFC receptor", meta.rfc_receptor, bd.rfc_cliente),
  ].filter((d): d is string => d !== null);
}

export interface RepComparable {
  uuid_rep: string | null;
  monto: number | null;
  moneda: string | null;
}

/**
 * Diferencias del XML de un REP. El `Comprobante@Total` de un REP es 0 por
 * norma (Anexo 20), así que el monto y la moneda se comparan contra los datos
 * del complemento de pagos (`Pago@Monto`, `Pago@MonedaP`).
 */
export function compararRepXml(
  meta: CfdiMeta,
  pago: { monto: number | null; moneda: string | null },
  bd: RepComparable,
): string[] {
  return [
    difTexto("XML UUID", meta.uuid, bd.uuid_rep),
    difImporte("XML monto del pago", pago.monto, bd.monto),
    difTexto("XML moneda del pago", pago.moneda, bd.moneda),
  ].filter((d): d is string => d !== null);
}

/** Lee `Pago@Monto` y `Pago@MonedaP` del complemento de pagos 2.0. */
export function leerPagoComplemento(xml: string): { monto: number | null; moneda: string | null } {
  return {
    monto: num(attr(xml, "Pago", "Monto")),
    moneda: attr(xml, "Pago", "MonedaP")?.toUpperCase() ?? null,
  };
}

/**
 * Consulta al Web Service público de estatus de CFDI del SAT.
 *
 * Extraído de `verificar-uuid-sat/index.ts` (v13.429.0) para poder reutilizar
 * exactamente las mismas reglas de mapeo de estatus desde el barrido masivo
 * (`verificar-sat-lote`).
 */
import {
  buildSoapEnvelope,
  esExpresionInvalida,
  variantesAIntentar,
  type AmpersandVariant,
} from "./satExpresion.ts";

export const SAT_ENDPOINT =
  "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

export type EstatusSat =
  | "Vigente"
  | "Cancelado"
  | "No Encontrado"
  | "No verificable"
  | "Error";

export interface ResultadoSat {
  estatus: EstatusSat;
  raw: string;
}

/** Tolerante a cualquier prefijo de namespace (`<Estado>`, `<ns1:Estado>`, …). */
export function parseSatResponse(xml: string): { estado: string; codigo: string } {
  const estado = /<(?:[\w.-]+:)?Estado>([^<]*)</i.exec(xml)?.[1] ?? "";
  const codigo = /<(?:[\w.-]+:)?CodigoEstatus>([^<]*)</i.exec(xml)?.[1] ?? "";
  return { estado: estado.trim(), codigo: codigo.trim() };
}

export function mapEstatus(estado: string, codigo: string): EstatusSat {
  const e = estado.toLowerCase();
  if (e.includes("vigente")) return "Vigente";
  if (e.includes("cancelado")) return "Cancelado";
  if (esExpresionInvalida(codigo, estado)) return "No verificable";
  if (codigo.includes("N - 202") || /no.*encontrad/i.test(estado)) return "No Encontrado";
  return "Error";
}

/** Normaliza RFCs con entidades XML heredadas (`AL&amp;0807074L5`). */
export function normalizarRfc(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()
    .toUpperCase();
}

export interface DatosConsultaSat {
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  uuid: string;
}

async function consultarSatVariante(
  datos: DatosConsultaSat,
  variant: AmpersandVariant,
): Promise<ResultadoSat> {
  const envelope = buildSoapEnvelope(datos, variant);
  const res = await fetch(SAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "http://tempuri.org/IConsultaCFDIService/Consulta",
    },
    body: envelope,
  });
  const xml = await res.text();
  if (!res.ok) return { estatus: "Error", raw: xml.slice(0, 500) };
  const { estado, codigo } = parseSatResponse(xml);
  return { estatus: mapEstatus(estado, codigo), raw: `${codigo} | ${estado}` };
}

/** Consulta con reintentos por variante de ampersand (RFCs con `&`). */
export async function consultarSat(
  rfcEmisor: string,
  rfcReceptor: string,
  total: number,
  uuid: string,
): Promise<ResultadoSat> {
  const datos: DatosConsultaSat = { rfcEmisor, rfcReceptor, total, uuid };
  let ultimo: ResultadoSat = { estatus: "Error", raw: "" };
  for (const variant of variantesAIntentar(rfcEmisor, rfcReceptor)) {
    ultimo = await consultarSatVariante(datos, variant);
    if (ultimo.estatus !== "No verificable") return ultimo;
  }
  return ultimo;
}

/**
 * Construcción de la "expresión impresa" que consume el WS de consulta del SAT.
 *
 * Reglas relevantes (Anexo 20 / Documentación WS Consulta CFDI v1.3):
 *   - Formato: `?re={RFC_EMISOR}&rr={RFC_RECEPTOR}&tt={TOTAL}&id={UUID}`
 *   - El total va con hasta 6 decimales y SIN ceros no significativos
 *     (99 centavos => `0.99`, 1 peso => `1.0`, cero => `0.0`).
 *
 * Caso especial — RFCs con `&` (ej. `AL&0807074L5`): el `&` también es el
 * separador de campos de la expresión, así que el SAT parte la cadena en el
 * lugar equivocado y responde `N - 601: La expresión impresa proporcionada no
 * es válida`. Es una falla conocida del servicio, por lo que probamos varias
 * codificaciones del ampersand en cascada.
 *
 * v13.322.17
 */

/** Codificaciones del `&` dentro de un valor (no del separador). */
export const AMPERSAND_VARIANTS = ["&", "&amp;", "%26"] as const;
export type AmpersandVariant = (typeof AMPERSAND_VARIANTS)[number];

/** Escapa un valor para insertarlo en el sobre SOAP (XML). */
export function escapeXmlValue(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Total con hasta 6 decimales, omitiendo ceros no significativos pero
 * conservando al menos un decimal (`1.0`, `0.0`, `371.2`, `0.99`).
 */
export function formatTotalSat(total: number): string {
  const fixed = (Number.isFinite(total) ? total : 0).toFixed(6);
  const trimmed = fixed.replace(/0+$/, "");
  return trimmed.endsWith(".") ? `${trimmed}0` : trimmed;
}

/** ¿Alguno de los RFCs trae ampersand? Sólo entonces hay que reintentar. */
export function requiereVariantesAmpersand(rfcEmisor: string, rfcReceptor: string): boolean {
  return rfcEmisor.includes("&") || rfcReceptor.includes("&");
}

/** Variantes a intentar, en orden de preferencia. */
export function variantesAIntentar(rfcEmisor: string, rfcReceptor: string): AmpersandVariant[] {
  return requiereVariantesAmpersand(rfcEmisor, rfcReceptor)
    ? [...AMPERSAND_VARIANTS]
    : ["&"];
}

export interface DatosExpresion {
  rfcEmisor: string;
  rfcReceptor: string;
  total: number;
  uuid: string;
}

/**
 * Devuelve la expresión ya lista para incrustarse en el XML del sobre SOAP:
 * los valores van escapados y los separadores usan `&amp;`.
 */
export function buildExpresionImpresa(
  { rfcEmisor, rfcReceptor, total, uuid }: DatosExpresion,
  variant: AmpersandVariant = "&",
): string {
  const codificar = (v: string) =>
    escapeXmlValue(variant === "&" ? v : v.replace(/&/g, variant));
  const re = codificar(rfcEmisor);
  const rr = codificar(rfcReceptor);
  const id = codificar(uuid);
  const tt = formatTotalSat(total);
  return `?re=${re}&amp;rr=${rr}&amp;tt=${tt}&amp;id=${id}`;
}

export function buildSoapEnvelope(datos: DatosExpresion, variant: AmpersandVariant = "&"): string {
  const expr = buildExpresionImpresa(datos, variant);
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Consulta>
      <tem:expresionImpresa>${expr}</tem:expresionImpresa>
    </tem:Consulta>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/** `true` cuando el SAT rechazó la expresión (código 601). */
export function esExpresionInvalida(codigo: string, estado: string): boolean {
  return /601/.test(codigo) || /expresi[oó]n impresa/i.test(`${codigo} ${estado}`);
}

import { useMutation } from "@tanstack/react-query";
import type { CfdiParsedResponse } from "../../../src/features/cxp/services/parseCfdi.types";
import type { TablesInsert } from "../../../src/integrations/supabase/types";

export { CfdiUploadError } from "../../../src/features/cxp/services/parseCfdi.types";
export type { CfdiParsedResponse } from "../../../src/features/cxp/services/parseCfdi.types";

export const XML_FACTURA = "11111111-1111-4111-8111-111111111111";
export const XML_NC = "22222222-2222-4222-8222-222222222222";
export const XML_ORG = "33333333-3333-4333-8333-333333333333";
const XML_NAME = "nota-ficticia.xml";
const PDF_NAME = "nota-ficticia.pdf";
const PDF_FICTICIO = "%PDF-1.4 fictitious-local-fixture";
// The existing inline fictitious XML in validarNcProveedor_test.ts, never uploaded.
export const XML_FICTICIO = `<cfdi:Comprobante Version="4.0" TipoDeComprobante="E" Moneda="MXN" Total="58" SubTotal="50" Fecha="2026-10-04T12:00:00"><cfdi:CfdiRelacionados TipoRelacion="01"><cfdi:CfdiRelacionado UUID="${XML_FACTURA}"/></cfdi:CfdiRelacionados><cfdi:Emisor Rfc="AAA010101AAA"/><cfdi:Receptor Rfc="BBB010101BBB"/><tfd:TimbreFiscalDigital UUID="${XML_NC}"/></cfdi:Comprobante>`;

export type XmlScenario = "matching" | "missing" | "different" | "rejected";
export interface XmlEvidence {
  scenario: XmlScenario;
  parses: { name: string; contentMatches: boolean; organizationId: string; facturaId: string | undefined }[];
  writes: TablesInsert<"proveedor_notas_credito">[];
  uploads: { ncId: string; organizationId: string | undefined; xmlName: string | null; pdfName: string | null }[];
  guardFailures: string[];
}
declare global {
  interface Window { __xmlEvidence: XmlEvidence }
}

const requested = new URLSearchParams(location.search).get("xmlScenario");
const scenario: XmlScenario = requested === "missing" || requested === "different" || requested === "rejected" ? requested : "matching";
export const xmlEvidence: XmlEvidence = { scenario, parses: [], writes: [], uploads: [], guardFailures: [] };
window.__xmlEvidence = xmlEvidence;

function guard(condition: unknown, reason: string): asserts condition {
  if (condition) return;
  xmlEvidence.guardFailures.push(reason);
  throw new Error(`XML fixture guard: ${reason}`);
}

function guardPlainFields(input: unknown, keys: string[]) {
  guard(typeof input === "object" && input !== null, "payload must be an object");
  guard(Object.getPrototypeOf(input) === Object.prototype && Reflect.ownKeys(input).length === keys.length
    && keys.every(key => Object.hasOwn(input, key)
      && Object.hasOwn(Object.getOwnPropertyDescriptor(input, key)!, "value")), "unexpected payload properties or prototype");
}

export async function parseCfdiXml(xml: File, categorias: unknown[], organizationId: string, facturaId?: string): Promise<CfdiParsedResponse> {
  const contentMatches = await xml.text() === XML_FICTICIO;
  guard(contentMatches && xml.name === XML_NAME && xml.type === "application/xml" && categorias.length === 0
    && organizationId === XML_ORG && facturaId === XML_FACTURA, "unexpected parser input or scope");
  xmlEvidence.parses.push({ name: xml.name, contentMatches, organizationId, facturaId });
  if (scenario === "rejected") throw new Error("El RFC emisor del XML no corresponde al proveedor de la factura seleccionada.");
  // Response shape reused from DialogNotaCreditoProveedor.identidad.test.tsx.
  return {
    cfdi: {
      uuid: XML_NC, serie: "NC", folio: "1", fecha: "2026-10-04", moneda: "MXN", tipo_cambio: 1,
      subtotal: 50, total: 58, iva_trasladado: 8, ieps_trasladado: 0, retenciones: 0,
      tipo_comprobante: "E", emisor: { rfc: "AAA010101AAA", nombre: "Proveedor ficticio", regimen: "601" },
      receptor: { rfc: "BBB010101BBB", nombre: "Organización ficticia" }, conceptos: [], relacionados: [XML_FACTURA],
    },
    ai: { categoria_id: null, notas: "Bonificación ficticia" },
    ...(scenario === "missing" ? {} : { nc_validacion: { factura_id: scenario === "different" ? "44444444-4444-4444-8444-444444444444" : XML_FACTURA } }),
  };
}

type CaptureMode = "manual" | "cfdi";
function currentMode(): CaptureMode {
  const dialog = document.getElementById("nc-folio")?.closest('[role="dialog"]');
  guard(dialog, "writer requires the real NC dialog");
  return dialog.querySelector('input[type="file"][accept*=".xml"]') ? "cfdi" : "manual";
}

export async function writeXmlNcFixture(facturaId: string | undefined, payload: TablesInsert<"proveedor_notas_credito">, mode: CaptureMode) {
  guard(facturaId === XML_FACTURA, "unexpected mutation invoice scope");
  guard(xmlEvidence.writes.length === 0 && xmlEvidence.uploads.length === 0, "duplicate or out-of-order writer");
  const fromXml = mode === "cfdi";
  const rejectedManual = scenario === "rejected" && mode === "manual";
  const clearedManual = scenario === "matching" && mode === "manual" && xmlEvidence.parses.length === 2;
  guard((scenario === "matching" && fromXml) || rejectedManual || clearedManual, "writer not allowed for this identity scenario or mode");
  guard(xmlEvidence.parses.length > 0 && xmlEvidence.parses.every(call => call.contentMatches
    && call.organizationId === XML_ORG && call.facturaId === XML_FACTURA), "writer requires correctly scoped processing");
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const expected = {
    proveedor_factura_id: XML_FACTURA, folio_nc: rejectedManual ? "MANUAL-FICTICIA" : "NC-1",
    fecha: rejectedManual ? localDate : "2026-10-04", monto: rejectedManual ? 10 : 58,
    subtotal: rejectedManual ? 10 : 50, tipo_cambio_mxn: 1, moneda: "MXN", tipo_cambio: null,
    motivo: "Bonificacion", descripcion: rejectedManual ? "" : "Bonificación ficticia", estado: "Borrador",
    uuid_fiscal: fromXml ? XML_NC : null,
  };
  guardPlainFields(payload, Object.keys(expected));
  guard(Object.entries(expected).every(([key, value]) => Object.is(payload[key as keyof typeof payload], value)), "unexpected writer payload");
  xmlEvidence.writes.push(structuredClone(payload));
  return { id: "xml-fixture-nc" };
}

export function useCrearNotaCredito(facturaId: string | undefined) {
  guard(facturaId === XML_FACTURA, "unexpected mutation hook invoice scope");
  return useMutation({ mutationFn: (payload: TablesInsert<"proveedor_notas_credito">) => writeXmlNcFixture(facturaId, payload, currentMode()) });
}

async function expectedAttachment(file: File | null, name: string, type: string, content: string) {
  guard(file instanceof File, "attachment must be a local File");
  guard(file.name === name && file.type === type && await file.text() === content, "unexpected attachment name, MIME or content");
  return file;
}

export async function subirArchivosNcProveedor(input: { ncId: string; organizationId: string | undefined; xmlFile: File | null; pdfFile: File | null }) {
  guardPlainFields(input, ["ncId", "organizationId", "xmlFile", "pdfFile"]);
  guard(input.ncId === "xml-fixture-nc" && input.organizationId === XML_ORG
    && scenario === "matching" && xmlEvidence.uploads.length === 0 && xmlEvidence.writes.length === 1
    && xmlEvidence.writes[0].uuid_fiscal === XML_NC && xmlEvidence.writes[0].proveedor_factura_id === XML_FACTURA,
  "unexpected attachment scope or writer state");
  const xml = await expectedAttachment(input.xmlFile, XML_NAME, "application/xml", XML_FICTICIO);
  const pdf = await expectedAttachment(input.pdfFile, PDF_NAME, "application/pdf", PDF_FICTICIO);
  xmlEvidence.uploads.push({ ncId: input.ncId, organizationId: input.organizationId, xmlName: xml.name, pdfName: pdf.name });
}

export interface TcDofVigente { fecha: string; usdMxn: number | null; eurMxn: number | null }
export async function fetchTcDofPorFecha(): Promise<TcDofVigente | null> {
  throw new Error("XML fixture: unexpected DOF lookup; this case is MXN only");
}

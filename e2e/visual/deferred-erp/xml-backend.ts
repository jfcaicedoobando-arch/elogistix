import { useMutation } from "@tanstack/react-query";
import type { CfdiParsedResponse } from "../../../src/features/cxp/services/parseCfdi.types";
import type { TablesInsert } from "../../../src/integrations/supabase/types";

export { CfdiUploadError } from "../../../src/features/cxp/services/parseCfdi.types";
export type { CfdiParsedResponse } from "../../../src/features/cxp/services/parseCfdi.types";

export const XML_FACTURA = "11111111-1111-4111-8111-111111111111";
export const XML_NC = "22222222-2222-4222-8222-222222222222";
export const XML_ORG = "33333333-3333-4333-8333-333333333333";
// The existing inline fictitious XML in validarNcProveedor_test.ts, never uploaded.
export const XML_FICTICIO = `<cfdi:Comprobante Version="4.0" TipoDeComprobante="E" Moneda="MXN" Total="58" SubTotal="50" Fecha="2026-10-04T12:00:00"><cfdi:CfdiRelacionados TipoRelacion="01"><cfdi:CfdiRelacionado UUID="${XML_FACTURA}"/></cfdi:CfdiRelacionados><cfdi:Emisor Rfc="AAA010101AAA"/><cfdi:Receptor Rfc="BBB010101BBB"/><tfd:TimbreFiscalDigital UUID="${XML_NC}"/></cfdi:Comprobante>`;

export type XmlScenario = "matching" | "missing" | "different" | "rejected";
export interface XmlEvidence {
  scenario: XmlScenario;
  parses: { name: string; contentMatches: boolean; organizationId: string; facturaId: string | undefined }[];
  writes: TablesInsert<"proveedor_notas_credito">[];
  uploads: { ncId: string; organizationId: string | undefined; xmlName: string | null; pdfName: string | null }[];
}
declare global {
  interface Window { __xmlEvidence: XmlEvidence }
}

const requested = new URLSearchParams(location.search).get("xmlScenario");
const scenario: XmlScenario = requested === "missing" || requested === "different" || requested === "rejected" ? requested : "matching";
export const xmlEvidence: XmlEvidence = { scenario, parses: [], writes: [], uploads: [] };
window.__xmlEvidence = xmlEvidence;

export async function parseCfdiXml(xml: File, categorias: unknown[], organizationId: string, facturaId?: string): Promise<CfdiParsedResponse> {
  const contentMatches = await xml.text() === XML_FICTICIO;
  xmlEvidence.parses.push({ name: xml.name, contentMatches, organizationId, facturaId });
  if (!contentMatches || categorias.length !== 0 || facturaId !== XML_FACTURA) throw new Error("XML fixture: unexpected parser input");
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

export function useCrearNotaCredito(_facturaId: string | undefined) {
  return useMutation({
    mutationFn: async (payload: TablesInsert<"proveedor_notas_credito">) => {
      xmlEvidence.writes.push(structuredClone(payload));
      return { id: "xml-fixture-nc" };
    },
  });
}

export async function subirArchivosNcProveedor(input: { ncId: string; organizationId: string | undefined; xmlFile: File | null; pdfFile: File | null }) {
  xmlEvidence.uploads.push({ ncId: input.ncId, organizationId: input.organizationId, xmlName: input.xmlFile?.name ?? null, pdfName: input.pdfFile?.name ?? null });
}

export interface TcDofVigente { fecha: string; usdMxn: number | null; eurMxn: number | null }
export async function fetchTcDofPorFecha(): Promise<TcDofVigente | null> {
  throw new Error("XML fixture: unexpected DOF lookup; this case is MXN only");
}

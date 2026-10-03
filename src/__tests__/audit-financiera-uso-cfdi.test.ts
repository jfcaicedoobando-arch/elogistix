import { beforeEach, describe, it, expect, vi } from "vitest";
import { normalizarUsoCfdi, usoCfdiDesdeXml } from "../../supabase/functions/_shared/usoCfdiEfectivo";
import { mapEventToFacturaPatch } from "../../supabase/functions/facturapi-webhook/helpers";

const respaldo = vi.hoisted(() => vi.fn());
vi.mock("../../supabase/functions/_shared/respaldarXmlTimbrado.ts", () => ({ respaldarXmlTimbrado: respaldo }));
vi.mock("../../supabase/functions/_shared/facturapiAuth.ts", () => ({ FACTURAPI_BASE: "https://www.facturapi.io/v2" }));
// Estos módulos se ejecutan en Deno. El adaptador de pruebas carga su código
// real sin incorporar sus imports HTTPS al proyecto TypeScript del frontend.
const persistenciaPath = "../../supabase/functions/facturapi-emitir/persistencia";
const recuperacionPath = "../../supabase/functions/facturapi-recuperar-claim/promoverFactura";
const webhookPath = "../../supabase/functions/facturapi-webhook/facturaPatch";
const { parseInvoiceResult, persistirFacturaTimbrada } = await import(persistenciaPath);
const { promoverFactura } = await import(recuperacionPath);
const { sanearPatchFactura } = await import(webhookPath);

const uuid = "12345678-1234-1234-1234-123456789ABC";
const xml = (uso = "S01", id = uuid) => `<cfdi:Comprobante><cfdi:Receptor UsoCFDI='${uso}'/><tfd:TimbreFiscalDigital UUID='${id}'/></cfdi:Comprobante>`;
function fakeDb(claim = "PENDING:1") {
  const state: Record<string, unknown> = { id: "f1", facturapi_id: claim, uso_cfdi: "G03" };
  const events: Array<Record<string, unknown>> = [];
  let patch: Record<string, unknown> = {};
  let matched = true;
  const chain = {
    update(value: Record<string, unknown>) { patch = value; matched = true; return chain; },
    eq(key: string, value: unknown) { if (state[key] !== value) matched = false; return chain; },
    select() { return chain; },
    async maybeSingle() { if (!matched) return { data: null, error: null }; Object.assign(state, patch); return { data: { id: "f1" }, error: null }; },
    async insert(value: Record<string, unknown>) { events.push(value); return { error: null }; },
  };
  return { client: { from: () => chain }, state, events };
}
const factura = { id: "f1", cliente_id: "c1", organization_id: "org1", uso_cfdi: "G03", serie: "A", numero: "BORRADOR-1", facturapi_id: "PENDING:1", facturapi_claim_at: null };
const invoice = { id: "remote1", uuid, use: "G03", series: "A", folio_number: 1 };

describe("uso CFDI efectivo de la misma identidad fiscal", () => {
  beforeEach(() => { respaldo.mockReset(); });
  it.each(["G03", " S01 ", "cp01", "D10"])("normaliza valores comunicados válidos: %s", (valor) => {
    expect(normalizarUsoCfdi(valor)).toBe(valor.trim().toUpperCase());
  });
  it.each([null, undefined, "", "G99", 123, "<script>"])("no inventa un uso ante valor inválido: %s", (valor) => {
    expect(normalizarUsoCfdi(valor)).toBeNull();
  });
  it("acepta sólo el uso del XML con el mismo UUID", () => {
    expect(usoCfdiDesdeXml(xml(), uuid.toLowerCase())).toBe("S01");
    expect(usoCfdiDesdeXml(xml("S01", "87654321-1234-1234-1234-123456789ABC"), uuid)).toBeNull();
    expect(usoCfdiDesdeXml("<cfdi:Receptor UsoCFDI='S01'/>", uuid)).toBeNull();
    expect(usoCfdiDesdeXml(xml("G99"), uuid)).toBeNull();
  });
  it("emisión responseG03/XMLS01 persisteS01 y conserva solicitadoG03 en auditoría", async () => {
    const db = fakeDb();
    const resultado = parseInvoiceResult(invoice, { serie: "A" } as never);
    const error = await persistirFacturaTimbrada({ supabase: db.client, factura, facturaId: "f1", user: { id: "u1" }, claim: { claimTag: "PENDING:1" }, ctx: { uso_cfdi: "G03" }, ambiente: "sandbox" } as never,
      resultado, { path: "org1/emitidas/test.xml", status: "ok", usoCfdi: usoCfdiDesdeXml(xml(), uuid) });
    expect(error).toBeNull();
    expect(db.state.uso_cfdi).toBe("S01");
    expect(db.events[0]?.detalles).toMatchObject({ uso_cfdi_solicitado: "G03", uso_cfdi_efectivo: "S01", fuente_uso_cfdi: "xml" });
  });
  it("sin XML, persiste el uso válido de respuesta; sin ambos conserva el solicitado", async () => {
    for (const use of ["S01", undefined]) {
      const db = fakeDb();
      await persistirFacturaTimbrada({ supabase: db.client, factura, facturaId: "f1", user: { id: "u1" }, claim: { claimTag: "PENDING:1" }, ctx: { uso_cfdi: "G03" }, ambiente: "sandbox" } as never,
        parseInvoiceResult({ ...invoice, use }, { serie: "A" } as never), { status: "error", path: null });
      expect(db.state.uso_cfdi).toBe(use ?? "G03");
    }
  });
  it("recuperación usa XML efectivo y conserva CAS contra claim cambiado", async () => {
    respaldo.mockResolvedValue({ status: "ok", path: "org1/emitidas/test.xml", usoCfdi: "S01" });
    for (const claim of ["PENDING:1", "PENDING:otro"]) {
      const db = fakeDb(claim);
      const response = await promoverFactura({ supabase: db.client, factura, match: invoice, claimTag: "PENDING:1", user: { id: "u1" }, ambiente: "sandbox", apiKey: "fixture-not-a-credential" } as never);
      expect(response.status).toBe(claim === "PENDING:1" ? 200 : 409);
      expect(db.state.uso_cfdi).toBe(claim === "PENDING:1" ? "S01" : "G03");
      if (claim === "PENDING:1") expect(db.events[0]?.detalles).toMatchObject({ uso_cfdi_solicitado: "G03", uso_cfdi_efectivo: "S01" });
    }
  });
  it("webhook con timbre aplica efectivo al pendiente y protege XML de eventos tardíos", () => {
    const mapped = mapEventToFacturaPatch({ type: "invoice.status_updated", data: { object: { ...invoice, use: "S01", status: "valid" } } });
    expect(mapped?.patch.uso_cfdi).toBe("S01");
    expect(sanearPatchFactura(mapped!, { id: "f1", estado: "Por timbrar" }).uso_cfdi).toBe("S01");
    expect(sanearPatchFactura(mapped!, { id: "f1", estado: "Emitida", uuid_fiscal: uuid }).uso_cfdi).toBeUndefined();
    const noTimbre = mapEventToFacturaPatch({ type: "invoice.status_updated", data: { object: { id: "r1", status: "valid", use: "S01" } } });
    expect(noTimbre?.patch.uso_cfdi).toBeUndefined();
  });
});

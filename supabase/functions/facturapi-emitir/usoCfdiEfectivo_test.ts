import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { usoCfdiDesdeXml, resolverUsoCfdiEfectivo } from "../_shared/usoCfdiEfectivo.ts";
import { respaldarXmlTimbrado } from "../_shared/respaldarXmlTimbrado.ts";
import { parseInvoiceResult, persistirFacturaTimbrada } from "./persistencia.ts";
import { emitirYActualizar } from "./emitir.ts";
import { promoverFactura } from "../facturapi-recuperar-claim/promoverFactura.ts";

const uuid = "12345678-1234-1234-1234-123456789ABC";
const xml = (id = uuid) => `<cfdi:Comprobante><cfdi:Receptor UsoCFDI="S01"/><tfd:TimbreFiscalDigital UUID="${id}"/></cfdi:Comprobante>`;
function fakeDb() {
  const state: Record<string, unknown> = { id: "f1", facturapi_id: "PENDING:1", uso_cfdi: "G03" };
  let patch: Record<string, unknown> = {};
  let matched = true;
  const events: Array<Record<string, unknown>> = [];
  const chain = {
    update(p: Record<string, unknown>) { patch = p; matched = true; return chain; },
    eq(k: string, v: unknown) { if (state[k] !== v) matched = false; return chain; },
    select() { return chain; },
    async maybeSingle() { if (!matched) return { data: null, error: null }; Object.assign(state, patch); return { data: { id: "f1" }, error: null }; },
    async insert(row: Record<string, unknown>) { events.push(row); return { error: null }; },
  };
  const storage = { from: () => ({ upload: () => Promise.resolve({ data: null, error: null }) }) };
  return { client: { from: () => chain, storage }, state, events };
}
const factura = { id: "f1", cliente_id: "c1", organization_id: "org1", uso_cfdi: "G03", serie: "A", numero: "BORRADOR-1", facturapi_id: "PENDING:1", facturapi_claim_at: null };
const invoice = { id: "remote1", uuid, use: "G03", series: "A", folio_number: 1 };

Deno.test("XML uso CFDI: UUID diferente o faltante no altera la identidad fiscal", () => {
  assertEquals(usoCfdiDesdeXml(xml(), uuid), "S01");
  assertEquals(usoCfdiDesdeXml(xml("87654321-1234-1234-1234-123456789ABC"), uuid), null);
  assertEquals(usoCfdiDesdeXml('<cfdi:Receptor UsoCFDI="S01"/>', uuid), null);
  assertEquals(resolverUsoCfdiEfectivo(null, " s01 "), { uso: "S01", fuente: "respuesta" });
  assertEquals(resolverUsoCfdiEfectivo(null, undefined), { uso: null, fuente: null });
});

Deno.test("emisión: respuesta G03 y XML S01 del mismo UUID persisten S01 y dejan solicitado en bitácora", async () => {
  const db = fakeDb();
  const error = await persistirFacturaTimbrada({ supabase: db.client, factura, facturaId: "f1", user: { id: "u1" }, claim: { claimTag: "PENDING:1" }, ctx: { uso_cfdi: "G03" }, ambiente: "sandbox" } as never,
    parseInvoiceResult(invoice, { serie: "A" } as never), { status: "ok", path: "org1/emitidas/test.xml", usoCfdi: usoCfdiDesdeXml(xml(), uuid) });
  assertEquals(error, null);
  assertEquals(db.state.uso_cfdi, "S01");
  const detalles = db.events[0].detalles as Record<string, unknown>;
  assertEquals(detalles.uso_cfdi_solicitado, "G03");
  assertEquals(detalles.uso_cfdi_efectivo, "S01");
});

Deno.test("respaldo: extrae uso efectivo del XML validado sin cambiar el resultado REP", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(xml(), { status: 200 }));
  try {
    const db = fakeDb();
    const emitida = await respaldarXmlTimbrado({ supabase: db.client, apiKey: "fixture", facturapiId: "remote1", organizationId: "org1", uuid, folder: "emitidas" });
    assertEquals(emitida.usoCfdi, "S01");
    const rep = await respaldarXmlTimbrado({ supabase: db.client, apiKey: "fixture", facturapiId: "remote1", organizationId: "org1", uuid, folder: "rep" });
    assertEquals("usoCfdi" in rep, false);
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("recuperación: XML del mismo UUID sincroniza uso y mantiene compare-and-set del claim", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(xml(), { status: 200 }));
  try {
    for (const claim of ["PENDING:1", "PENDING:otro"]) {
      const db = fakeDb(); db.state.facturapi_id = claim;
      const result = await promoverFactura({ supabase: db.client, factura, match: invoice, claimTag: "PENDING:1", user: { id: "u1" }, ambiente: "sandbox", apiKey: "fixture" } as never);
      assertEquals(result.status, claim === "PENDING:1" ? 200 : 409);
      assertEquals(db.state.uso_cfdi, claim === "PENDING:1" ? "S01" : "G03");
    }
  } finally { globalThis.fetch = originalFetch; }
});


Deno.test("emisión exitosa con XML distinto informa ambos usos sin reintento; sin XML omite efectivo", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const xmlDisponible of [true, false]) {
      globalThis.fetch = () => Promise.resolve(xmlDisponible ? new Response(xml()) : new Response("unavailable", { status: 503 }));
      const db = fakeDb();
      const enviados: unknown[] = [];
      const ctx = {
        serie: "A", uso_cfdi: "G03", metodo_pago: "PUE", forma_pago: "03", moneda: "MXN", tipo_cambio: 1,
        receptor: { legal_name: "Fixture", tax_id: "AAA010101AAA", tax_system: "601", address: { zip: "64000" } },
        conceptos: [{ descripcion: "Prueba", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", clave_unidad: "E48" }],
        external_id: "PENDING:1",
      };
      const res = await emitirYActualizar({
        supabase: db.client, apiKey: "fixture", ambiente: "sandbox", ctx, factura, facturaId: "f1", user: { id: "u1" },
        claim: { claimTag: "PENDING:1", release: () => { throw new Error("No liberar un timbre confirmado"); } },
        facturapi: { invoices: { create: (payload: unknown) => { enviados.push(payload); return Promise.resolve(invoice); } } },
      } as never);
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.uuid, uuid);
      assertEquals(body.uso_cfdi_solicitado, "G03");
      assertEquals(body.uso_cfdi_efectivo, xmlDisponible ? "S01" : undefined);
      assertEquals(body.fuente_uso_cfdi, xmlDisponible ? "xml" : undefined);
      assertEquals(db.state.uso_cfdi, xmlDisponible ? "S01" : "G03");
      assertEquals(enviados.length, 1);
      assertEquals((enviados[0] as { idempotency_key: string }).idempotency_key, "PENDING:1");
    }
  } finally { globalThis.fetch = originalFetch; }
});

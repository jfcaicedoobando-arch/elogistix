import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateContext, buildFacturapiPayload, type FacturaContext } from "./helpers.ts";
import { cargarContexto } from "./contexto.ts";
import { resultadoUsoCfdi } from "./resultadoUsoCfdi.ts";

const base: FacturaContext = {
  forma_pago: "03", metodo_pago: "PUE", uso_cfdi: "G03", moneda: "MXN", tipo_cambio: 1,
  receptor: { legal_name: "Fixture", tax_id: "AAA010101AAA", tax_system: "601", address: { zip: "64000" } },
  conceptos: [{ descripcion: "Prueba", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", clave_unidad: "E48", tipo_iva: "no_objeto" }],
};
Deno.test("preflight I rechaza 616/G03 genérico e individual antes del PAC", () => {
  for (const rfc of ["XAXX010101000", "XEXX010101000", "AAAA010101AAA"]) {
    const ctx = { ...base, receptor: { ...base.receptor, tax_id: rfc, tax_system: "616" } };
    assertEquals(validateContext(ctx).some((i) => i.field === "uso_cfdi" && i.message.includes("616")), true);
  }
});
Deno.test("preflight I acepta genérico616S01, moral601G03 y física605D01 sin sustituir uso", () => {
  for (const [rfc, regimen, uso] of [["XAXX010101000", "616", "S01"], ["AAA010101AAA", "601", "G03"], ["AAAA010101AAA", "605", "D01"]]) {
    const ctx = { ...base, uso_cfdi: uso, receptor: { ...base.receptor, tax_id: rfc, tax_system: regimen } };
    assertEquals(validateContext(ctx), []);
    assertEquals(buildFacturapiPayload(ctx).use, uso);
  }
});
Deno.test("preflight I separa uso/persona, genérico/régimen y usos no emitibles", () => {
  assertEquals(validateContext({ ...base, uso_cfdi: "D01", receptor: { ...base.receptor, tax_system: "605" } }).some((i) => i.message.includes("persona moral")), true);
  assertEquals(validateContext({ ...base, receptor: { ...base.receptor, tax_id: "XAXX010101000" } }).some((i) => i.field === "regimen_fiscal"), true);
  for (const uso of ["CP01", "CN01", "P01"]) {
    assertEquals(validateContext({ ...base, uso_cfdi: uso }).some((i) => i.field === "uso_cfdi"), true);
  }
});

function fakeDb(regimen: string) {
  const calls: string[] = [];
  const data: Record<string, unknown> = {
    clientes: { id: "c1", nombre: "Fixture", rfc: "AAA010101AAA", regimen_fiscal: regimen, codigo_postal: "64000" },
    conceptos_factura: [{ descripcion: "Prueba", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", clave_unidad: "E48", tipo_iva: "no_objeto", tasa_iva_aplicada: null }],
  };
  return { calls, client: { from(tabla: string) {
    calls.push(`from:${tabla}`);
    const result = { data: data[tabla] ?? null, error: null };
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "is", "not", "order", "limit"]) chain[op] = () => chain;
    chain.maybeSingle = () => Promise.resolve(result);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
    chain.update = () => { throw new Error("No se debe tomar claim ni escribir en el preflight"); };
    return chain;
  } } };
}
const factura = {
  id: "f1", cliente_id: "c1", organization_id: "org1", rfc_cliente: "XAXX010101000",
  subtotal: 100, iva: 0, total: 100, moneda: "MXN", tipo_cambio: 1,
  forma_pago: "03", metodo_pago: "PUE", uso_cfdi: "G03",
};
Deno.test("cargarContexto valida el RFC snapshot enviado y rechaza sin escribir claim", async () => {
  const db = fakeDb("601");
  const res = await cargarContexto(db.client as never, "f1", factura as never, null);
  if (!(res instanceof Response)) throw new Error("Se validó el cliente en lugar del receptor enviado");
  assertEquals(res.status, 422);
  assertEquals((await res.json()).issues.some((i: { field: string }) => i.field === "regimen_fiscal"), true);
});
Deno.test("cargarContexto acepta snapshot genérico616S01 y conserva payload exacto", async () => {
  const db = fakeDb("616");
  const ctx = await cargarContexto(db.client as never, "f1", { ...factura, uso_cfdi: "S01" } as never, null);
  if (ctx instanceof Response) throw new Error(await ctx.text());
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.customer.tax_id, factura.rfc_cliente);
  assertEquals(payload.customer.tax_system, "616");
  assertEquals(payload.use, "S01");
});
Deno.test("handler mantiene guard contexto antes de claim y PAC; no se aplica a recuperación", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  let position = -1;
  for (const step of ["const context = await cargarContexto(", "if (context instanceof Response) return context;", "const claim = await claimFactura(", "return emitirYActualizar({"]) {
    const next = source.indexOf(step);
    assertEquals(next > position, true, step);
    position = next;
  }
  for (const path of ["../facturapi-recuperar-claim/promoverFactura.ts", "../facturapi-webhook/facturaPatch.ts"]) {
    const recovery = await Deno.readTextFile(new URL(path, import.meta.url));
    assertEquals(recovery.includes("validarUsoCfdiIngreso"), false);
  }
  assertStringIncludes(source, 'if (factura.facturapi_id) return json({ error: "ya_timbrada"');
});
Deno.test("resultado aditivo informa sólo uso XML verificado y no inventa al faltar XML", () => {
  assertEquals(resultadoUsoCfdi("G03", "S01"), { uso_cfdi_solicitado: "G03", uso_cfdi_efectivo: "S01", fuente_uso_cfdi: "xml" });
  assertEquals(resultadoUsoCfdi("G03", null), { uso_cfdi_solicitado: "G03" });
});

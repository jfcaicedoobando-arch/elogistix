import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cargarContexto } from "./contexto.ts";
import { buildFacturapiPayload, type FacturaContext } from "./helpers.ts";
import type { FacturaRow } from "./types.ts";

type Fila = Record<string, unknown>;
interface Consulta { tabla: string; columnas: string[]; filtros: Array<[string, unknown]>; ids?: string[] }
const factura: FacturaRow = {
  id: "f1", cliente_id: "c1", organization_id: "org-1", subtotal: 400,
  iva: 64, total: 464, moneda: "MXN", tipo_cambio: 1,
  forma_pago: "03", metodo_pago: "PUE", uso_cfdi: "G03",
  embarque_id: "e18", expediente: "ELNAC00018", referencia_bl: "HEADER",
};
const embarques: Fila[] = [
  { id: "e18", organization_id: "org-1", expediente: "ELNAC00018", bl_master: null, bl_house: null },
  { id: "e19", organization_id: "org-1", expediente: "ELNAC00019", bl_master: "M19", bl_house: "H19" },
  { id: "e20", organization_id: "org-1", expediente: "ELNAC00020", bl_master: null, bl_house: null },
];
function concepto(embarque_id: string | null, precio_unitario: number, descripcion = "Flete"): Fila {
  return { factura_id: "f1", embarque_id, descripcion, cantidad: 1, precio_unitario,
    clave_sat: "78101800", clave_unidad: "E48", tipo_iva: "gravado_16",
    tasa_iva_aplicada: 0.16, tasa_ret_isr: 0, tasa_ret_iva: 0, deleted_at: null };
}

/** Sólo lecturas locales; proyecta columnas y aplica filtros como el adaptador. */
function fakeSupabase(filas: Fila[], origenes = embarques, falloEmbarques = false) {
  const consultas: Consulta[] = [];
  const tablas: Record<string, Fila[]> = {
    clientes: [{ id: "c1", nombre: "ACME SA", rfc: "AAA010101AAA", codigo_postal: "64000", regimen_fiscal: "601" }],
    conceptos_factura: filas, embarques: origenes, contactos_cliente: [],
  };
  const from = (tabla: string) => {
    const consulta: Consulta = { tabla, columnas: [], filtros: [] };
    consultas.push(consulta);
    const resultado = (single: boolean) => {
      if (tabla === "embarques" && falloEmbarques) return { data: null, error: { message: "unavailable" } };
      const rows = (tablas[tabla] ?? []).filter((fila) =>
        consulta.filtros.every(([key, value]) => fila[key] === value) &&
        (!consulta.ids || consulta.ids.includes(String(fila.id)))
      ).map((fila) => Object.fromEntries(consulta.columnas.map((key) => [key, fila[key]])));
      return { data: single ? rows[0] ?? null : rows, error: null };
    };
    const chain = {
      select: (columnas: string) => { consulta.columnas = columnas.split(",").map((s) => s.trim()); return chain; },
      eq: (key: string, value: unknown) => { consulta.filtros.push([key, value]); return chain; },
      is: (key: string, value: unknown) => { consulta.filtros.push([key, value]); return chain; },
      in: (_key: string, ids: string[]) => { consulta.ids = ids; return chain; },
      not: () => chain, order: () => chain, limit: () => chain,
      maybeSingle: () => Promise.resolve(resultado(true)),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resultado(false)).then(resolve),
    };
    return chain;
  };
  return { consultas, client: { from } as unknown as Parameters<typeof cargarContexto>[0] };
}

async function contextoValido(client: Parameters<typeof cargarContexto>[0], cabecera = factura) {
  const ctx = await cargarContexto(client, cabecera.id, cabecera, null);
  if (ctx instanceof Response) throw new Error(`Contexto rechazado: ${await ctx.text()}`);
  return ctx;
}

Deno.test("143: dos orígenes conservan su referencia por concepto y en el PDF", async () => {
  const filas = [concepto("e18", 100), concepto("e19", 300)];
  const snapshot = structuredClone(filas);
  const fake = fakeSupabase(filas, [...embarques].reverse());
  const ctx = await contextoValido(fake.client);
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.items.map((c) => c.product.description), [
    "[Exp. ELNAC00018] Flete", "[Exp. ELNAC00019 · BL/M: M19 · BL/H: H19] Flete",
  ]);
  assertStringIncludes(payload.pdf_custom_section ?? "", "ELNAC00018");
  assertStringIncludes(payload.pdf_custom_section ?? "", "ELNAC00019");
  assert(!payload.pdf_custom_section?.includes("HEADER"));
  assertEquals(payload.items.map((c) => [c.quantity, c.product.price, c.product.taxes]), [
    [1, 100, [{ type: "IVA", rate: 0.16, factor: "Tasa" }]],
    [1, 300, [{ type: "IVA", rate: 0.16, factor: "Tasa" }]],
  ]);
  assertEquals(filas, snapshot, "No se reescriben descripciones persistidas");
  assertEquals(fake.consultas.filter((q) => q.tabla === "embarques").map((q) => [q.ids, q.filtros]), [
    [["e18", "e19"], [["organization_id", "org-1"]]],
  ]);
  assertEquals("embarque_id" in payload.items[0].product, false);
  assertEquals("referencias" in payload.items[0].product, false);
});

Deno.test("143: tres embarques, orden intercalado y repetidos no duplican el pie PDF", async () => {
  const ctx = await contextoValido(fakeSupabase([
    concepto("e19", 100), concepto("e18", 100), concepto("e20", 100), concepto("e19", 100),
  ]).client);
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.items.map((c) => c.product.description.match(/Exp\. (\w+)/)?.[1]), [
    "ELNAC00019", "ELNAC00018", "ELNAC00020", "ELNAC00019",
  ]);
  assertEquals(payload.pdf_custom_section?.match(/<h4>/g)?.length, 3);
});

Deno.test("143: una línea manual en factura mixta no hereda el primer embarque", async () => {
  const ctx = await contextoValido(fakeSupabase([
    concepto("e18", 100), concepto(null, 300, "Honorarios manuales"),
  ]).client);
  assertEquals(buildFacturapiPayload(ctx).items[1].product.description, "Honorarios manuales");
  assertEquals(ctx.conceptos[1].referencias, null);
});

Deno.test("143: origen ausente o de otra organización nunca usa referencias de cabecera", async () => {
  for (const origenes of [embarques.slice(0, 1), [
    embarques[0], { ...embarques[1], organization_id: "otra-org", expediente: "NO-EXPOSURE" },
  ]]) {
    const ctx = await contextoValido(fakeSupabase([
      concepto("e18", 100), concepto("e19", 300),
    ], origenes).client);
    const payload = buildFacturapiPayload(ctx);
    assertEquals(payload.items[1].product.description, "Flete");
    assert(!JSON.stringify(payload).includes("NO-EXPOSURE"));
  }
});

Deno.test("143: consulta fallida no produce una descripción atribuida a otro embarque", async () => {
  const fake = fakeSupabase([concepto("e18", 100), concepto("e19", 300)], embarques, true);
  const ctx = await cargarContexto(fake.client, factura.id, factura, null);
  assert(ctx instanceof Response);
  assertEquals(ctx.status, 500);
  assertEquals((await ctx.json()).error, "referencias_embarque_query_failed");
});

Deno.test("143: origen explícito sin referencias mantiene la descripción intacta", async () => {
  const ctx = await contextoValido(fakeSupabase([concepto("e19", 400)], [
    { id: "e19", organization_id: "org-1", expediente: null, bl_master: " ", bl_house: null },
  ]).client);
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.items[0].product.description, "Flete");
  assertEquals(payload.pdf_custom_section, undefined);
});

Deno.test("143: factura legada de un embarque conserva expediente y BL de cabecera", async () => {
  const fake = fakeSupabase([concepto(null, 100), concepto(null, 300)]);
  const ctx = await contextoValido(fake.client);
  assertEquals(buildFacturapiPayload(ctx).items.map((c) => c.product.description), [
    "[Exp. ELNAC00018 · BL/H: HEADER] Flete", "[Exp. ELNAC00018 · BL/H: HEADER] Flete",
  ]);
  assertEquals(buildFacturapiPayload(ctx).pdf_custom_section?.match(/<h4>/g)?.length, 1);
});

Deno.test("143: factura totalmente manual sin referencias no añade prefijos", async () => {
  const fake = fakeSupabase([concepto(null, 400)]);
  const ctx = await contextoValido(fake.client, { ...factura, embarque_id: null, expediente: null, referencia_bl: null });
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.items[0].product.description, "Flete");
  assertEquals(payload.pdf_custom_section, undefined);
  assertEquals(fake.consultas.filter((q) => q.tabla === "embarques"), []);
});

Deno.test("143: líneas borradas u otra factura no aportan referencias al documento", async () => {
  const ctx = await contextoValido(fakeSupabase([
    concepto("e18", 400), { ...concepto("e19", 300), deleted_at: "2026-01-01" },
    { ...concepto("e20", 500), factura_id: "otra-factura" },
  ]).client);
  const payload = buildFacturapiPayload(ctx);
  assertEquals(payload.items.length, 1);
  assert(!payload.pdf_custom_section?.includes("ELNAC00019"));
  assert(!payload.pdf_custom_section?.includes("ELNAC00020"));
});

Deno.test("143: el mapeo sólo cambia descripciones y el bloque PDF, no datos fiscales", async () => {
  const ctx = await contextoValido(fakeSupabase([concepto("e18", 100), concepto("e19", 300)]).client);
  const fiscal: FacturaContext = { ...ctx, moneda: "USD", tipo_cambio: 20,
    external_id: "PENDING:test", sustituye_uuid: "11111111-2222-3333-4444-555555555555",
    conceptos: ctx.conceptos.map((c, i) => ({ ...c, cantidad: 0.5 + i, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 })),
  };
  const conReferencias = buildFacturapiPayload(fiscal);
  const sinReferencias = buildFacturapiPayload({ ...fiscal, referencias: null,
    conceptos: fiscal.conceptos.map((c) => ({ ...c, referencias: null })),
  });
  delete conReferencias.pdf_custom_section;
  conReferencias.items.forEach((item, i) => { item.product.description = fiscal.conceptos[i].descripcion; });
  assertEquals(conReferencias, sinReferencias);
});

/** Query-aware memory double: no server, token, SDK or fiscal emission. */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cargarFacturaPpd } from "./etapaDatos.ts";

type Client = Parameters<typeof cargarFacturaPpd>[0];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const live = {
  id: "factura-1", organization_id: "org-1", deleted_at: null,
  uuid_fiscal: "UUID-FIXTURE", metodo_pago: "PPD", cliente_id: "cliente-1",
};
function fixture(row: typeof live | null, error: { message: string } | null = null) {
  const calls: unknown[][] = [];
  const filters: Array<[string, unknown]> = [];
  const q = {
    select: (columns: string) => { calls.push(["select", columns]); return q; },
    eq: (key: string, value: unknown) => { filters.push([key, value]); return q; },
    is: (key: string, value: unknown) => { filters.push([key, value]); return q; },
    maybeSingle: () => Promise.resolve({
      data: row && filters.every(([key, value]) => Reflect.get(row, key) === value) ? row : null, error,
    }),
  };
  return { calls, filters, client: { from: (table: string) => { calls.push(["from", table]); return q; } } as unknown as Client };
}
Deno.test("REP data: explicit same-tenant and live-parent query", async () => {
  const f = fixture(live);
  const result = await cargarFacturaPpd(f.client, "factura-1", "org-1", json);
  assertEquals(result.ok, true);
  assertEquals(f.filters, [["id", "factura-1"], ["organization_id", "org-1"], ["deleted_at", null]]);
  assertEquals(f.calls[0], ["from", "facturas"]);
});
for (const [name, row, error] of [
  ["missing", null, null],
  ["database read failed", live, { message: "fixture query failure" }],
] as const) {
  Deno.test(`REP data: ${name} fails closed`, async () => {
    const f = fixture(row, error);
    const result = await cargarFacturaPpd(f.client, "factura-1", "org-1", json);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.response.status, 404);
      assertEquals((await result.response.json()).error, "factura_not_found");
    }
  });
}
for (const [metodo_pago, uuid_fiscal, expected] of [
  ["PUE", "UUID-FIXTURE", "no_aplica_rep"], ["PPD", "", "factura_no_timbrada"],
]) {
  Deno.test(`REP data: live ${expected} keeps its previous rejection`, async () => {
    const result = await cargarFacturaPpd(fixture({ ...live, metodo_pago, uuid_fiscal }).client, "factura-1", "org-1", json);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.response.status, 409);
      assertEquals((await result.response.json()).error, expected);
    }
  });
}

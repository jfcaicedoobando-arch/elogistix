/**
 * Ola 3 · B — boundary server-side de estados timbrables (factura).
 *
 * Una llamada directa a la Edge Function nunca debe timbrar una factura ya
 * emitida, cancelada, sustituida o en papelera, aunque la UI se equivoque.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ESTADOS_FACTURA_TIMBRABLES, validarEstadoTimbrable } from "./emitir.ts";
import type { FacturaRow } from "./types.ts";

const base = (estado: string) => ({ id: "f-1", estado, total: 100 } as unknown as FacturaRow);

Deno.test("factura: estados timbrables reales = Borrador / Por timbrar", () => {
  assertEquals([...ESTADOS_FACTURA_TIMBRABLES], ["Borrador", "Por timbrar"]);
  for (const estado of ESTADOS_FACTURA_TIMBRABLES) {
    assertEquals(validarEstadoTimbrable(base(estado)), null);
  }
});

Deno.test("factura: estados no timbrables devuelven 409 estado_no_timbrable", async () => {
  for (const estado of ["Emitida", "Pagada", "Parcialmente pagada", "Vencida", "Cancelada", "Sustituida"]) {
    const res = validarEstadoTimbrable(base(estado));
    assert(res, `${estado} debería bloquear`);
    assertEquals(res!.status, 409);
    assertEquals((await res!.json()).error, "estado_no_timbrable");
  }
});

Deno.test("factura: load y claim filtran papelera y estado (guard contra carrera)", async () => {
  const source = await Deno.readTextFile(new URL("./emitir.ts", import.meta.url));
  const loadIdx = source.indexOf("export async function loadFactura");
  const claimIdx = source.indexOf("export async function claimFactura");
  const load = source.slice(loadIdx, claimIdx);
  const claim = source.slice(claimIdx);
  assert(load.includes('.is("deleted_at", null)'), "loadFactura debe excluir papelera");
  assert(claim.includes('.is("deleted_at", null)'), "claimFactura debe excluir papelera");
  assert(claim.includes('.in("estado", ESTADOS_FACTURA_TIMBRABLES)'), "claimFactura debe exigir estado timbrable");
});

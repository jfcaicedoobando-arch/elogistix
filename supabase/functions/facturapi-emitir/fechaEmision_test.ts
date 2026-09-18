/**
 * Realineo de `fecha_emision` al día del timbre: reemplaza al bloqueo
 * `fecha_emision_desfasada`, que dejaba el borrador atorado porque la UI no
 * tiene campo de fecha. El T/C lo resuelve el trigger del DOF; si no hay
 * publicación utilizable, el timbrado se detiene con un 422 reintentable.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
// deno-lint-ignore-file no-explicit-any
import { fechaDesfasada, hoyMx, realinearFechaEmision } from "./fechaEmision.ts";
import { ESTADOS_FACTURA_TIMBRABLES } from "./emitir.ts";
import type { FacturaRow } from "./types.ts";

const AHORA = new Date("2026-09-18T19:04:28.071Z");
const HOY = hoyMx(AHORA);
const USER = { id: "u-1", email: "karol@elogistix.com" };

const factura = (fecha: string | null): FacturaRow => ({
  id: "f-1", numero: "A-100", estado: "Borrador", moneda: "USD",
  fecha_emision: fecha, cliente_id: "c-1", organization_id: "org-1",
} as FacturaRow);

/** Fake mínimo del cliente: registra el update y devuelve la fila o el error. */
function fakeSupabase(resultado: { data?: unknown; error?: { message: string; code?: string } }) {
  const calls: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const builder = {
    update(patch: Record<string, unknown>) { calls.push(patch); return builder; },
    eq() { return builder; },
    is() { return builder; },
    in() { return builder; },
    select() { return builder; },
    maybeSingle() { return Promise.resolve({ data: resultado.data ?? null, error: resultado.error ?? null }); },
    insert(row: Record<string, unknown>) { inserts.push(row); return Promise.resolve({ error: null }); },
  };
  return { supabase: { from: () => builder } as any, calls, inserts };
}

Deno.test("fecha de hoy: no escribe nada y devuelve la misma fila", async () => {
  assertEquals(fechaDesfasada(factura(HOY), AHORA), false);
  const { supabase, calls } = fakeSupabase({});
  const row = factura(HOY);
  const res = await realinearFechaEmision(supabase, row, ESTADOS_FACTURA_TIMBRABLES, USER, AHORA);
  assertEquals(res, row);
  assertEquals(calls.length, 0);
});

Deno.test("fecha de ayer: actualiza a hoy, deja bitácora y continúa", async () => {
  assertEquals(fechaDesfasada(factura("2026-09-17"), AHORA), true);
  const actualizada = { ...factura(HOY), tipo_cambio: 18.5 };
  const { supabase, calls, inserts } = fakeSupabase({ data: actualizada });
  const res = await realinearFechaEmision(supabase, factura("2026-09-17"), ESTADOS_FACTURA_TIMBRABLES, USER, AHORA);
  assert(!(res instanceof Response), "debe devolver la fila releída");
  assertEquals((res as FacturaRow).fecha_emision, HOY);
  assertEquals(calls, [{ fecha_emision: HOY }]);
  assertEquals(inserts[0].accion, "realinear_fecha_emision_timbrado");
  assertEquals((inserts[0].detalles as Record<string, unknown>).fecha_anterior, "2026-09-17");
});

Deno.test("sin fecha capturada: no se toca la fila (otros guards deciden)", async () => {
  const { supabase, calls } = fakeSupabase({});
  await realinearFechaEmision(supabase, factura(null), ESTADOS_FACTURA_TIMBRABLES, USER, AHORA);
  assertEquals(calls.length, 0);
});

Deno.test("DOF sin publicación utilizable: 422 reintentable, sin timbrar", async () => {
  for (const marca of ["LC_FACTURA_SIN_TC_DOF", "LC_FACTURA_TC_DOF_OBSOLETO"]) {
    const { supabase } = fakeSupabase({ error: { message: `${marca}: detalle`, code: "22023" } });
    const res = await realinearFechaEmision(supabase, factura("2026-09-17"), ESTADOS_FACTURA_TIMBRABLES, USER, AHORA);
    assert(res instanceof Response, `${marca} debe bloquear`);
    assertEquals((res as Response).status, 422);
    assertEquals((await (res as Response).json()).error, "tc_dof_no_disponible");
  }
});

Deno.test("la fila dejó de ser timbrable entre la carga y el realineo: 409", async () => {
  const { supabase } = fakeSupabase({ data: null });
  const res = await realinearFechaEmision(supabase, factura("2026-09-17"), ESTADOS_FACTURA_TIMBRABLES, USER, AHORA);
  assert(res instanceof Response);
  assertEquals((res as Response).status, 409);
  assertEquals((await (res as Response).json()).error, "estado_no_timbrable");
});

Deno.test("el update nunca toca facturas timbradas ni en papelera", async () => {
  const source = await Deno.readTextFile(new URL("./fechaEmision.ts", import.meta.url));
  assert(source.includes('.is("deleted_at", null)'), "debe excluir papelera");
  assert(source.includes('.is("facturapi_id", null)'), "debe excluir facturas ya timbradas");
  assert(source.includes('.in("estado", estadosTimbrables)'), "debe exigir estado timbrable");
});

Deno.test("ya no existe el bloqueo fecha_emision_desfasada", async () => {
  const source = await Deno.readTextFile(new URL("./emitir.ts", import.meta.url));
  assert(!source.includes("fecha_emision_desfasada"), "el guard bloqueante debe estar retirado");
  const handler = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(handler.includes("realinearFechaEmision"), "el handler debe realinear la fecha");
  assert(
    handler.indexOf("realinearFechaEmision") < handler.indexOf("claimFactura(supabase"),
    "el realineo corre antes del claim y del PAC",
  );
});

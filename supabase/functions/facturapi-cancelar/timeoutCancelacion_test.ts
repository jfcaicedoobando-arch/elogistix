/**
 * Ola 13 · R4EF-06 — Cobertura de la rama 504 (REF-01) de facturapi-cancelar
 * (facturas). Mismo patrón que los hermanos REP/NC.
 * Run: deno test --no-check supabase/functions/facturapi-cancelar/timeoutCancelacion_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { marcarTimeoutCancelacion } from "./timeoutCancelacion.ts";

function crearClienteFalso() {
  const llamadas: Array<{ tabla: string; metodo: string; args: unknown[] }> = [];
  const cliente = {
    from(tabla: string) {
      const builder: Record<string, unknown> = {};
      for (const m of ["update", "insert", "select", "eq", "is", "or"]) {
        builder[m] = (...args: unknown[]) => {
          llamadas.push({ tabla, metodo: m, args });
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject);
      return builder;
    },
  };
  return { cliente, llamadas };
}

Deno.test("R4EF-06/facturas: la rama 504 marca verifying sin pisar solicitud en curso", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacion({
    supabase: cliente,
    facturaId: "fac-1",
    organizationId: "org-1",
    usuarioId: "usr-1",
    usuarioEmail: "admin@x.mx",
    motivo: "02",
    op: "invoices.cancel",
    timeoutMs: 15_000,
  });

  const upd = llamadas.find((l) => l.tabla === "facturas" && l.metodo === "update");
  assert(upd, "debe actualizar facturas");
  const payload = upd!.args[0] as Record<string, unknown>;
  assertEquals(payload.cancellation_status, "verifying");
  assertEquals(payload.cancelacion_motivo, "02");
  assert(typeof payload.cancelacion_solicitada_en === "string");

  const guard = llamadas.find((l) => l.tabla === "facturas" && l.metodo === "is");
  assertEquals(guard?.args, ["cancelacion_solicitada_en", null]);

  const bit = llamadas.find((l) => l.tabla === "bitacora_actividad" && l.metodo === "insert");
  assert(bit, "debe escribir bitácora");
  const row = bit!.args[0] as Record<string, unknown>;
  assertEquals(row.accion, "facturapi_cancelar_timeout");
  assertEquals(row.detalles, { op: "invoices.cancel", timeout_ms: 15_000, motivo: "02" });
});

Deno.test("R4EF-06/facturas: el index llama al helper ANTES de responder 504 (estructural)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, 'import { marcarTimeoutCancelacion } from "./timeoutCancelacion.ts";');
  const iRama = src.indexOf("err instanceof FacturapiTimeoutError");
  const iHelper = src.indexOf("marcarTimeoutCancelacion({", iRama);
  assert(iRama >= 0 && iHelper > iRama);
  assertStringIncludes(src.slice(iHelper, iHelper + 900), "504");
});

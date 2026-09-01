/**
 * Ola 13 · R4EF-06 — Cobertura de la rama 504 (R3EF-01) de facturapi-cancelar-rep.
 * Unit tests del helper con cliente falso (deps inyectadas, patrón
 * helpers_test.ts) + aserción estructural del index.ts (patrón de inspección de
 * fuente, para no ejecutar Deno.serve ni requerir red).
 * Run: deno test --no-check supabase/functions/facturapi-cancelar-rep/timeoutCancelacionRep_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { marcarTimeoutCancelacionRep } from "./timeoutCancelacionRep.ts";

/** Cliente Supabase falso: registra la cadena from/update/eq/or/insert. */
function crearClienteFalso(updateRows: unknown[] | null = null, estadoActual = "none") {
  const llamadas: Array<{ tabla: string; metodo: string; args: unknown[] }> = [];
  const cliente = {
    from(tabla: string) {
      let esUpdate = false;
      const builder: Record<string, unknown> = {};
      for (const m of ["update", "insert", "select", "eq", "is", "or"]) {
        builder[m] = (...args: unknown[]) => {
          if (m === "update") esUpdate = true;
          llamadas.push({ tabla, metodo: m, args });
          if (m === "select" && esUpdate) {
            return Promise.resolve({ data: updateRows, error: null });
          }
          return builder;
        };
      }
      builder.maybeSingle = () => {
        llamadas.push({ tabla, metodo: "maybeSingle", args: [] });
        return Promise.resolve({ data: { rep_cancellation_status: estadoActual }, error: null });
      };
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject);
      return builder;
    },
  };
  return { cliente, llamadas };
}

const PARAMS = {
  pagoId: "pago-1",
  organizationId: "org-1",
  usuarioId: "usr-1",
  usuarioEmail: "admin@x.mx",
  motivo: "02",
  op: "invoices.cancel",
  timeoutMs: 15_000,
};

Deno.test("R4EF-06/REP: la rama 504 marca verifying sin pisar un estatus activo", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacionRep({ supabase: cliente, ...PARAMS });

  const upd = llamadas.find((l) => l.tabla === "pagos_factura" && l.metodo === "update");
  assert(upd, "debe actualizar pagos_factura");
  assertEquals((upd!.args[0] as Record<string, unknown>).rep_cancellation_status, "verifying");
  assertEquals((upd!.args[0] as Record<string, unknown>).rep_motivo_cancel, "02");

  // Guard anti-pisado: pagos_factura no tiene rep_cancelacion_solicitada_en;
  // el guard equivalente es no tocar un estatus activo.
  const guard = llamadas.find((l) => l.tabla === "pagos_factura" && l.metodo === "or");
  assertEquals(guard?.args[0], "rep_cancellation_status.is.null,rep_cancellation_status.eq.none");

  const eqId = llamadas.find((l) => l.tabla === "pagos_factura" && l.metodo === "eq");
  assertEquals(eqId?.args, ["id", "pago-1"]);
});

Deno.test("R4EF-06/REP: motivo ausente se persiste como null", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacionRep({ supabase: cliente, ...PARAMS, motivo: undefined });
  const upd = llamadas.find((l) => l.tabla === "pagos_factura" && l.metodo === "update");
  assertEquals((upd!.args[0] as Record<string, unknown>).rep_motivo_cancel, null);
});

Deno.test("R4EF-06/REP: bitácora facturapi_rep_cancelar_timeout con op y timeout_ms", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacionRep({ supabase: cliente, ...PARAMS });
  const bit = llamadas.find((l) => l.tabla === "bitacora_actividad" && l.metodo === "insert");
  assert(bit, "debe escribir bitácora");
  const row = bit!.args[0] as Record<string, unknown>;
  assertEquals(row.accion, "facturapi_rep_cancelar_timeout");
  assertEquals(row.modulo, "facturacion");
  assertEquals(row.entidad_id, "pago-1");
  assertEquals(row.detalles, { op: "invoices.cancel", timeout_ms: 15_000, motivo: "02", persisted: false, cancellation_status: "none" });
});

Deno.test("v13.821.6/REP: si verifying quedó persistido, res.persisted=true", async () => {
  const { cliente } = crearClienteFalso([{ id: "pago-1", rep_cancellation_status: "verifying" }]);
  const res = await marcarTimeoutCancelacionRep({ supabase: cliente, ...PARAMS });
  assertEquals(res, { persisted: true, cancellationStatus: "verifying" });
});

Deno.test("v13.821.6/REP: si NO se pudo persistir, res.persisted=false", async () => {
  const { cliente } = crearClienteFalso([], "none");
  const res = await marcarTimeoutCancelacionRep({ supabase: cliente, ...PARAMS });
  assertEquals(res, { persisted: false, cancellationStatus: "none" });
});

Deno.test("R4EF-06/REP: el index llama al helper ANTES de responder 504 (estructural)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, 'import { marcarTimeoutCancelacionRep } from "./timeoutCancelacionRep.ts";');
  const iRama = src.indexOf("err instanceof FacturapiTimeoutError");
  const iHelper = src.indexOf("marcarTimeoutCancelacionRep({", iRama);
  assert(iRama >= 0 && iHelper > iRama, "la rama de timeout debe marcar verifying");
  assertStringIncludes(src.slice(iHelper, iHelper + 1400), "202");
  assertStringIncludes(src.slice(iHelper, iHelper + 1400), "504");
});

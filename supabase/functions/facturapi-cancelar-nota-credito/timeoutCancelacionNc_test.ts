/**
 * Ola 13 · R4EF-06 — Cobertura de la rama 504 (R3EF-01) de
 * facturapi-cancelar-nota-credito.
 * Run: deno test --no-check supabase/functions/facturapi-cancelar-nota-credito/timeoutCancelacionNc_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { marcarTimeoutCancelacionNc } from "./timeoutCancelacionNc.ts";

/** Cliente Supabase falso: registra la cadena from/update/eq/is/or/insert. */
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
        return Promise.resolve({ data: { cancellation_status: estadoActual }, error: null });
      };
      builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject);
      return builder;
    },
  };
  return { cliente, llamadas };
}

const PARAMS = {
  ncId: "nc-1",
  organizationId: "org-1",
  usuarioId: "usr-1",
  usuarioEmail: "admin@x.mx",
  motivo: "02",
  op: "invoices.cancel",
  timeoutMs: 15_000,
};

Deno.test("R4EF-06/NC: la rama 504 marca verifying con fecha de solicitud y guard anti-pisado", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacionNc({ supabase: cliente, ...PARAMS });

  const upd = llamadas.find((l) => l.tabla === "factura_notas_credito" && l.metodo === "update");
  assert(upd, "debe actualizar factura_notas_credito");
  const payload = upd!.args[0] as Record<string, unknown>;
  assertEquals(payload.cancellation_status, "verifying");
  assertEquals(payload.cancelacion_motivo, "02");
  assert(
    typeof payload.cancelacion_solicitada_en === "string" &&
      !Number.isNaN(Date.parse(payload.cancelacion_solicitada_en as string)),
    "debe sellar cancelacion_solicitada_en con ISO válido",
  );

  // Guard: no pisar una solicitud ya en curso.
  const guard = llamadas.find((l) => l.tabla === "factura_notas_credito" && l.metodo === "is");
  assertEquals(guard?.args, ["cancelacion_solicitada_en", null]);

  const eqId = llamadas.find((l) => l.tabla === "factura_notas_credito" && l.metodo === "eq");
  assertEquals(eqId?.args, ["id", "nc-1"]);
});

Deno.test("R4EF-06/NC: motivo ausente se persiste como null", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacionNc({ supabase: cliente, ...PARAMS, motivo: undefined });
  const upd = llamadas.find((l) => l.tabla === "factura_notas_credito" && l.metodo === "update");
  assertEquals((upd!.args[0] as Record<string, unknown>).cancelacion_motivo, null);
});

Deno.test("R4EF-06/NC: bitácora facturapi_nc_cancelar_timeout con op y timeout_ms", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  await marcarTimeoutCancelacionNc({ supabase: cliente, ...PARAMS });
  const bit = llamadas.find((l) => l.tabla === "bitacora_actividad" && l.metodo === "insert");
  assert(bit, "debe escribir bitácora");
  const row = bit!.args[0] as Record<string, unknown>;
  assertEquals(row.accion, "facturapi_nc_cancelar_timeout");
  assertEquals(row.modulo, "facturacion");
  assertEquals(row.entidad_id, "nc-1");
  assertEquals(row.detalles, { op: "invoices.cancel", timeout_ms: 15_000, motivo: "02", persisted: false, cancellation_status: "none" });
});

Deno.test("v13.821.6/NC: si verifying quedó persistido, res.persisted=true", async () => {
  const { cliente } = crearClienteFalso([{ id: "nc-1", cancellation_status: "verifying" }]);
  const res = await marcarTimeoutCancelacionNc({ supabase: cliente, ...PARAMS });
  assertEquals(res, { persisted: true, cancellationStatus: "verifying" });
});

Deno.test("v13.821.6/NC: si NO se pudo persistir, res.persisted=false", async () => {
  const { cliente } = crearClienteFalso([], "none");
  const res = await marcarTimeoutCancelacionNc({ supabase: cliente, ...PARAMS });
  assertEquals(res, { persisted: false, cancellationStatus: "none" });
});

Deno.test("R4EF-06/NC: el index llama al helper ANTES de responder 504 (estructural)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, 'import { marcarTimeoutCancelacionNc } from "./timeoutCancelacionNc.ts";');
  const iRama = src.indexOf("err instanceof FacturapiTimeoutError");
  const iHelper = src.indexOf("marcarTimeoutCancelacionNc({", iRama);
  assert(iRama >= 0 && iHelper > iRama, "la rama de timeout debe marcar verifying");
  assertStringIncludes(src.slice(iHelper, iHelper + 1400), "202");
  assertStringIncludes(src.slice(iHelper, iHelper + 1400), "504");
});

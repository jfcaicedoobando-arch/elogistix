/**
 * Ola 13 · R4EF-06 — Cobertura de la rama de timeout (REF-01) de
 * facturapi-cancelar (facturas). Mismo patrón que los hermanos REP/NC.
 *
 * v13.821.6: el helper informa si `verifying` quedó persistido y el index
 * responde 202 (solicitud aceptada, resultado incierto) en ese caso; sólo
 * responde 504 cuando NO se pudo persistir.
 *
 * Run: deno test --no-check supabase/functions/facturapi-cancelar/timeoutCancelacion_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { marcarTimeoutCancelacion } from "./timeoutCancelacion.ts";

/**
 * @param updateRows filas devueltas por el UPDATE ... RETURNING
 * @param estadoActual `cancellation_status` leído cuando el UPDATE no tocó filas
 */
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

const base = {
  facturaId: "fac-1",
  organizationId: "org-1",
  usuarioId: "usr-1",
  usuarioEmail: "admin@x.mx",
  motivo: "02",
  op: "invoices.cancel",
  timeoutMs: 15_000,
};

Deno.test("R4EF-06/facturas: la rama de timeout marca verifying sin pisar solicitud en curso", async () => {
  const { cliente, llamadas } = crearClienteFalso([{ id: "fac-1", cancellation_status: "verifying" }]);
  const res = await marcarTimeoutCancelacion({ supabase: cliente, ...base });

  assertEquals(res, { persisted: true, cancellationStatus: "verifying" });

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
  assertEquals(row.detalles, {
    op: "invoices.cancel",
    timeout_ms: 15_000,
    motivo: "02",
    persisted: true,
    cancellation_status: "verifying",
  });
});

Deno.test("v13.821.6: si ya había solicitud en curso (pending) se considera persistido", async () => {
  const { cliente } = crearClienteFalso([], "pending");
  const res = await marcarTimeoutCancelacion({ supabase: cliente, ...base });
  assertEquals(res, { persisted: true, cancellationStatus: "pending" });
});

Deno.test("v13.821.6: si NO se pudo persistir verifying, persisted=false (el index responde 5xx)", async () => {
  const { cliente } = crearClienteFalso([], "none");
  const res = await marcarTimeoutCancelacion({ supabase: cliente, ...base });
  assertEquals(res, { persisted: false, cancellationStatus: "none" });
});

Deno.test("R4EF-06/facturas: el index llama al helper ANTES de responder (estructural)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, 'import { marcarTimeoutCancelacion } from "./timeoutCancelacion.ts";');
  const iRama = src.indexOf("err instanceof FacturapiTimeoutError");
  const iHelper = src.indexOf("marcarTimeoutCancelacion({", iRama);
  assert(iRama >= 0 && iHelper > iRama);
  const rama = src.slice(iHelper, iHelper + 1800);
  // Persistido ⇒ 202 con contrato pending/uncertain; no persistido ⇒ 504.
  assertStringIncludes(rama, "marca.persisted");
  assertStringIncludes(rama, "uncertain: true");
  assertStringIncludes(rama, "202");
  assertStringIncludes(rama, "504");
  const i202 = rama.indexOf("202");
  const i504 = rama.indexOf("504");
  assert(i202 < i504, "el 202 (aceptada) debe evaluarse antes del 504 (error)");
});

Deno.test("v13.821.6: invoices.cancel usa el timeout propio (margen para persistir y responder)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assertStringIncludes(src, "FACTURAPI_CANCEL_TIMEOUT_MS");
  const shared = await Deno.readTextFile(new URL("../_shared/facturapiClient.ts", import.meta.url));
  assertStringIncludes(shared, "export const FACTURAPI_CANCEL_TIMEOUT_MS = 22_000;");
  // El timeout global de las demás operaciones no cambia.
  assertStringIncludes(shared, "export const FACTURAPI_SDK_TIMEOUT_MS = 30_000;");
});

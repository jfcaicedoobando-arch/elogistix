/**
 * Ola 13 · R4EF-06 — Primer test de auth-email-hook: dedupe de
 * `registrarPendiente` (R3EF-03 fail-closed + stale-pending, REF-03).
 * Cliente falso con deps inyectadas; sin red.
 * Run: deno test --no-check supabase/functions/auth-email-hook/dedupe_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { registrarPendiente } from "./dedupe.ts";

const PARAMS = {
  messageId: "auth-run-1",
  emailType: "recovery",
  recipient: "usuario@x.mx",
  runId: "run-1",
};

/** Ventana de staleness del módulo: 10 min (PENDING_STALE_MS). */
const HACE_5_MIN = () => new Date(Date.now() - 5 * 60 * 1000).toISOString();
const HACE_11_MIN = () => new Date(Date.now() - 11 * 60 * 1000).toISOString();

/**
 * Cliente falso de email_send_log. Cadena soportada:
 *  - from().upsert(...).select('message_id')  → cfg.upsert
 *  - from().select(...).eq(...).maybeSingle() → cfg.prevRow
 *  - from().update(...).eq(...)               → { error: null }
 */
function crearClienteFalso(cfg: {
  upsert?: { data: unknown[] | null; error: { message: string } | null };
  prevRow?: { status: string; created_at: string } | null;
} = {}) {
  const upsert = cfg.upsert ?? { data: [{ message_id: PARAMS.messageId }], error: null };
  const prevRow = cfg.prevRow ?? null;
  const llamadas: Array<{ metodo: string; args: unknown[] }> = [];
  const cliente = {
    from(tabla: string) {
      assertEquals(tabla, "email_send_log");
      let esUpsert = false;
      const builder: Record<string, unknown> = {
        maybeSingle: () => {
          llamadas.push({ metodo: "maybeSingle", args: [] });
          return Promise.resolve({ data: prevRow, error: null });
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(esUpsert ? upsert : { data: null, error: null }).then(resolve, reject),
      };
      for (const m of ["upsert", "update", "select", "eq"]) {
        builder[m] = (...args: unknown[]) => {
          if (m === "upsert") esUpsert = true;
          llamadas.push({ metodo: m, args });
          return builder;
        };
      }
      return builder;
    },
  };
  return { cliente, llamadas };
}

Deno.test("R4EF-06/dedupe: upsert nuevo (fila insertada) no deduplica ni re-toca la fila", async () => {
  const { cliente, llamadas } = crearClienteFalso();
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: false, logError: false });
  assert(!llamadas.some((l) => l.metodo === "update"), "no debe re-poner pending");
  assert(!llamadas.some((l) => l.metodo === "maybeSingle"), "no debe releer la fila");
});

Deno.test("R4EF-06/dedupe R3EF-03(a): upsert fallido => logError, fail-closed (el caller NO encola)", async () => {
  const { cliente, llamadas } = crearClienteFalso({
    upsert: { data: null, error: { message: "connection reset" } },
  });
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: false, logError: true });
  assert(
    !llamadas.some((l) => l.metodo === "update" || l.metodo === "maybeSingle"),
    "con el log roto no hay dedupe posible: cortar ahí",
  );
});

Deno.test("R4EF-06/dedupe: fila previa 'sent' deduplica (el reintento no re-encola)", async () => {
  const { cliente, llamadas } = crearClienteFalso({
    upsert: { data: [], error: null },
    prevRow: { status: "sent", created_at: HACE_5_MIN() },
  });
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: true, logError: false });
  assert(!llamadas.some((l) => l.metodo === "update"));
});

Deno.test("R4EF-06/dedupe: fila 'pending' reciente (<10 min) deduplica", async () => {
  const { cliente } = crearClienteFalso({
    upsert: { data: [], error: null },
    prevRow: { status: "pending", created_at: HACE_5_MIN() },
  });
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: true, logError: false });
});

Deno.test("R4EF-06/dedupe R3EF-03(b): 'pending' atascada (>10 min) NO deduplica y reinicia la ventana", async () => {
  const creada = HACE_11_MIN();
  const { cliente, llamadas } = crearClienteFalso({
    upsert: { data: [], error: null },
    prevRow: { status: "pending", created_at: creada },
  });
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: false, logError: false });

  const upd = llamadas.find((l) => l.metodo === "update");
  assert(upd, "debe re-poner la misma fila en pending");
  const payload = upd!.args[0] as Record<string, unknown>;
  assertEquals(payload.status, "pending");
  assertEquals(payload.error_message, null);
  // created_at se refresca a propósito: reinicia la ventana de antigüedad.
  assert(
    typeof payload.created_at === "string" &&
      Date.parse(payload.created_at as string) > Date.parse(creada),
    "created_at debe refrescarse al reintento",
  );
  const eq = llamadas.find((l) => l.metodo === "eq");
  assertEquals(eq?.args, ["message_id", PARAMS.messageId]);
});

Deno.test("R4EF-06/dedupe: fila 'failed' es reintento legítimo (vuelve a pending)", async () => {
  const { cliente, llamadas } = crearClienteFalso({
    upsert: { data: [], error: null },
    prevRow: { status: "failed", created_at: HACE_5_MIN() },
  });
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: false, logError: false });
  assert(llamadas.some((l) => l.metodo === "update"));
});

Deno.test("R4EF-06/dedupe: upsert ignorado sin fila legible (maybeSingle null) reintenta sobre la fila", async () => {
  const { cliente } = crearClienteFalso({
    upsert: { data: [], error: null },
    prevRow: null,
  });
  const r = await registrarPendiente(cliente, PARAMS);
  assertEquals(r, { deduplicated: false, logError: false });
});

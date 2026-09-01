/**
 * Ola P2 — Rate limit de la guarda de CxP: topes por usuario/organización y
 * fail-CLOSED cuando el contador no responde.
 */
// deno-lint-ignore-file no-import-prefix
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { autorizarCxp, leerOrgHeader, ORG_HEADER } from "./cxpGuard.ts";
import {
  CORS,
  fakeAuth,
  llamadasRpc,
  log,
  ORG_A,
  ORG_B,
  OPTS,
} from "./cxpGuardFixtures.ts";

Deno.test("rate limit por usuario: 429 con Retry-After", async () => {
  const r = await autorizarCxp(
    fakeAuth({
      memberships: { [ORG_B]: "contador" },
      rpc: (_n, args) =>
        String(args.p_key).includes(":user:")
          ? { data: { ok: false, retry_after: 42 }, error: null }
          : { data: { ok: true }, error: null },
    }),
    CORS,
    log,
    OPTS,
  );
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.res.status, 429);
  assertEquals(r.res.headers.get("Retry-After"), "42");
  await r.res.json();
});

Deno.test("rate limit por organización: 429 aunque el usuario tenga cupo", async () => {
  const r = await autorizarCxp(
    fakeAuth({
      memberships: { [ORG_B]: "contador" },
      rpc: (_n, args) =>
        String(args.p_key).includes(":org:")
          ? { data: { ok: false }, error: null }
          : { data: { ok: true }, error: null },
    }),
    CORS,
    log,
    OPTS,
  );
  assert(!r.ok);
  if (!r.ok) {
    assertEquals(r.res.status, 429);
    await r.res.json();
  }
});

Deno.test("contador de rate limit caído: fail-CLOSED con 503", async () => {
  const r = await autorizarCxp(
    fakeAuth({
      memberships: { [ORG_B]: "contador" },
      rpc: () => ({ data: null, error: { message: "boom" } }),
    }),
    CORS,
    log,
    OPTS,
  );
  assert(!r.ok);
  if (!r.ok) {
    assertEquals(r.res.status, 503);
    assertEquals((await r.res.json()).error, "rate_limit_unavailable");
  }
});

Deno.test("rate limit nulo o malformado: 503; sólo ok booleano es válido", async () => {
  for (const data of [null, {}, { ok: "true" }, [], { ok: 1 }]) {
    const r = await autorizarCxp(
      fakeAuth({
        memberships: { [ORG_B]: "contador" },
        rpc: () => ({ data, error: null }),
      }),
      CORS,
      log,
      OPTS,
    );
    assert(!r.ok);
    if (!r.ok) {
      assertEquals(r.res.status, 503);
      assertEquals((await r.res.json()).error, "rate_limit_unavailable");
    }
  }
});

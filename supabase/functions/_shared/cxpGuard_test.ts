/**
 * Ola P2 — Pruebas deterministas de la guarda compartida de CxP: membresía,
 * rol y organización objetivo. El rate limit vive en cxpGuardRateLimit_test.ts.
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


Deno.test("usuario sólo de A intentando operar B: 403", async () => {
  const r = await autorizarCxp(
    fakeAuth({ memberships: { [ORG_A]: "contador" } }),
    CORS,
    log,
    OPTS,
  );
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.res.status, 403);
  const body = await r.res.json();
  assertEquals(body.error, "Requiere un rol con permiso de captura CxP");
});

Deno.test("rol sin permiso CxP: 403 (operador y roles de portal)", async () => {
  for (const rol of ["operador", "cliente", "agente_carga", "vendedor"]) {
    const r = await autorizarCxp(
      fakeAuth({ memberships: { [ORG_B]: rol } }),
      CORS,
      log,
      OPTS,
    );
    assert(!r.ok, `${rol} no debe pasar la guarda`);
    if (!r.ok) assertEquals(r.res.status, 403);
  }
});

Deno.test("rol con permiso CxP y contador disponible: autoriza y devuelve la org", async () => {
  for (const rol of ["contador", "auxiliar_contable", "admin_org"]) {
    const r = await autorizarCxp(
      fakeAuth({ memberships: { [ORG_B]: rol } }),
      CORS,
      log,
      OPTS,
    );
    assert(r.ok, `${rol} debe pasar la guarda`);
    if (r.ok) assertEquals(r.orgId, ORG_B);
  }
});

Deno.test("multiempresa A/B usa la organización activa B aunque A sea primera", async () => {
  llamadasRpc.length = 0;
  const r = await autorizarCxp(
    fakeAuth({ memberships: { [ORG_A]: "contador", [ORG_B]: "contador" } }),
    CORS,
    log,
    OPTS,
  );
  assert(r.ok);
  assert(
    llamadasRpc.some((x) => String(x.args.p_key).includes(`:org:${ORG_B}`)),
  );
  assert(
    !llamadasRpc.some((x) => String(x.args.p_key).includes(`:org:${ORG_A}`)),
  );
});

Deno.test("super_admin vigente autoriza B sin membresía convencional", async () => {
  const r = await autorizarCxp(
    fakeAuth({ globalRoles: ["super_admin"] }),
    CORS,
    log,
    OPTS,
  );
  assert(r.ok);
  if (r.ok) assertEquals(r.orgId, ORG_B);
});

Deno.test("organizationId ausente o inválido: 400 fail-closed", async () => {
  for (
    const organizationId of [
      "",
      "org-b",
      "11111111-1111-4111-8111-11111111111",
      "zzzzzzzz-1111-4111-8111-111111111111",
    ]
  ) {
    const r = await autorizarCxp(fakeAuth({}), CORS, log, {
      ...OPTS,
      organizationId,
    });
    assert(!r.ok);
    if (!r.ok) assertEquals(r.res.status, 400);
  }
});

Deno.test("ORG_HEADER es el header del contrato compartido", () => {
  assertEquals(ORG_HEADER, "x-organization-id");
});

Deno.test("acepta el UUID nil-style de la organización principal real", async () => {
  // v13.823.4: el regex anterior exigía versión [1-5] y variante RFC, lo que
  // rechazaba con 400 a la organización principal real y rompía la captura.
  const ORG_PRINCIPAL = "00000000-0000-0000-0000-000000000001";
  const r = await autorizarCxp(
    fakeAuth({ memberships: { [ORG_PRINCIPAL]: "contador" } }),
    CORS,
    log,
    { ...OPTS, organizationId: ORG_PRINCIPAL },
  );
  assert(r.ok);
  if (r.ok) assertEquals(r.orgId, ORG_PRINCIPAL);
});

Deno.test("leerOrgHeader lee x-organization-id y recorta espacios", () => {
  const req = new Request("https://x.test/fn", {
    method: "POST",
    headers: { "x-organization-id": ` ${ORG_B} ` },
  });
  assertEquals(leerOrgHeader(req), ORG_B);
  assertEquals(leerOrgHeader(new Request("https://x.test/fn")), "");
});

/**
 * Ola P2 — Pruebas deterministas de la guarda compartida de CxP:
 * membresía, rol, rate limit por usuario/organización y fail-CLOSED.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { autorizarCxp } from "./cxpGuard.ts";
import type { AuthContext } from "./auth.ts";

type RpcResp = { data: unknown; error: { message: string } | null };

interface FakeOpts {
  memberships?: Record<string, string>;
  globalRoles?: string[];
  rpc?: (name: string, args: Record<string, unknown>) => RpcResp;
}

const llamadasRpc: { name: string; args: Record<string, unknown> }[] = [];

function fakeAuth(opts: FakeOpts): AuthContext {
  const memberships = opts.memberships ?? {};
  const globalRoles = opts.globalRoles ?? [];
  const adminClient = {
    from(tabla: string) {
      let columnas = "";
      const filtros: Record<string, string> = {};
      const chain = {
        select(cols: string) {
          columnas = cols;
          return chain;
        },
        eq(col: string, val: string) {
          filtros[col] = val;
          return chain;
        },
        in(_col: string, values: string[]) {
          filtros.roles = values.join(",");
          return chain;
        },
        maybeSingle(): Promise<{ data: unknown; error: null }> {
          if (tabla === "organization_members") {
            const rolOrg = memberships[filtros.organization_id];
            return Promise.resolve({ data: rolOrg ? { role: rolOrg } : null, error: null });
          }
          if (tabla === "user_roles" && filtros.role === "super_admin") {
            return Promise.resolve({
              data: globalRoles.includes("super_admin") ? { role: "super_admin" } : null,
              error: null,
            });
          }
          if (tabla === "user_roles" && filtros.roles) {
            const permitidos = filtros.roles.split(",");
            const role = globalRoles.find((r) => permitidos.includes(r));
            return Promise.resolve({ data: role ? { role } : null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
    rpc(name: string, args: Record<string, unknown>) {
      llamadasRpc.push({ name, args });
      const r = opts.rpc?.(name, args) ?? { data: { ok: true }, error: null };
      return Promise.resolve(r);
    },
  };
  return { userId: "u-1", authHeader: "Bearer x", anonClient: adminClient, adminClient } as unknown as AuthContext;
}


const log = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  setUserId: () => undefined,
  setOrganizationId: () => undefined,
  finish: () => undefined,
} as unknown as Parameters<typeof autorizarCxp>[2];

const CORS = { "Access-Control-Allow-Origin": "*" };
const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const OPTS = {
  organizationId: ORG_B,
  fn: "prueba-cxp",
  rlUsuario: { windowSeconds: 3600, max: 5 },
  rlOrg: { windowSeconds: 3600, max: 10 },
};

Deno.test("usuario sólo de A intentando operar B: 403", async () => {
  const r = await autorizarCxp(fakeAuth({ memberships: { [ORG_A]: "contador" } }), CORS, log, OPTS);
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.res.status, 403);
  const body = await r.res.json();
  assertEquals(body.error, "Requiere un rol con permiso de captura CxP");
});

Deno.test("rol sin permiso CxP: 403 (operador y roles de portal)", async () => {
  for (const rol of ["operador", "cliente", "agente_carga", "vendedor"]) {
    const r = await autorizarCxp(fakeAuth({ memberships: { [ORG_B]: rol } }), CORS, log, OPTS);
    assert(!r.ok, `${rol} no debe pasar la guarda`);
    if (!r.ok) assertEquals(r.res.status, 403);
  }
});

Deno.test("rol con permiso CxP y contador disponible: autoriza y devuelve la org", async () => {
  for (const rol of ["contador", "auxiliar_contable", "admin_org"]) {
    const r = await autorizarCxp(fakeAuth({ memberships: { [ORG_B]: rol } }), CORS, log, OPTS);
    assert(r.ok, `${rol} debe pasar la guarda`);
    if (r.ok) assertEquals(r.orgId, ORG_B);
  }
});

Deno.test("multiempresa A/B usa la organización activa B aunque A sea primera", async () => {
  llamadasRpc.length = 0;
  const r = await autorizarCxp(fakeAuth({ memberships: { [ORG_A]: "contador", [ORG_B]: "contador" } }), CORS, log, OPTS);
  assert(r.ok);
  assert(llamadasRpc.some((x) => String(x.args.p_key).includes(`:org:${ORG_B}`)));
  assert(!llamadasRpc.some((x) => String(x.args.p_key).includes(`:org:${ORG_A}`)));
});

Deno.test("super_admin vigente autoriza B sin membresía convencional", async () => {
  const r = await autorizarCxp(fakeAuth({ globalRoles: ["super_admin"] }), CORS, log, OPTS);
  assert(r.ok);
  if (r.ok) assertEquals(r.orgId, ORG_B);
});

Deno.test("organizationId ausente o inválido: 400 fail-closed", async () => {
  for (const organizationId of ["", "org-b", "11111111-1111-1111-1111-111111111111"]) {
    const r = await autorizarCxp(fakeAuth({}), CORS, log, { ...OPTS, organizationId });
    assert(!r.ok);
    if (!r.ok) assertEquals(r.res.status, 400);
  }
});

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
      fakeAuth({ memberships: { [ORG_B]: "contador" }, rpc: () => ({ data, error: null }) }),
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

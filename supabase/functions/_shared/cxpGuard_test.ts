/**
 * Ola P2 — Pruebas deterministas de la guarda compartida de CxP:
 * membresía, rol, rate limit por usuario/organización y fail-CLOSED.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { autorizarCxp } from "./cxpGuard.ts";
import type { AuthContext } from "./auth.ts";

type RpcResp = { data: unknown; error: { message: string } | null };

interface FakeOpts {
  orgId?: string | null;
  roles?: string[];
  rpc?: (name: string, args: Record<string, unknown>) => RpcResp;
}

const llamadasRpc: { name: string; args: Record<string, unknown> }[] = [];

function fakeAuth(opts: FakeOpts): AuthContext {
  const roles = opts.roles ?? [];
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
        limit: () => chain,
        maybeSingle(): Promise<{ data: unknown; error: null }> {
          if (tabla === "organization_members" && columnas.includes("organization_id")) {
            return Promise.resolve({
              data: opts.orgId ? { organization_id: opts.orgId } : null,
              error: null,
            });
          }
          if (tabla === "organization_members") {
            const rolOrg = roles.find((r) => r !== "super_admin") ?? null;
            return Promise.resolve({ data: opts.orgId ? { role: rolOrg } : null, error: null });
          }
          if (tabla === "user_roles" && filtros.role === "super_admin") {
            return Promise.resolve({
              data: roles.includes("super_admin") ? { role: "super_admin" } : null,
              error: null,
            });
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
const OPTS = {
  fn: "prueba-cxp",
  rlUsuario: { windowSeconds: 3600, max: 5 },
  rlOrg: { windowSeconds: 3600, max: 10 },
};

Deno.test("sin membresía de organización: 403 sin detalles internos", async () => {
  const r = await autorizarCxp(fakeAuth({ orgId: null }), CORS, log, OPTS);
  assert(!r.ok);
  if (r.ok) return;
  assertEquals(r.res.status, 403);
  const body = await r.res.json();
  assertEquals(body.error, "Tu usuario no pertenece a ninguna organización");
});

Deno.test("rol sin permiso CxP: 403 (operador y roles de portal)", async () => {
  for (const rol of ["operador", "cliente", "agente_carga", "vendedor"]) {
    const r = await autorizarCxp(fakeAuth({ orgId: "org-1", roles: [rol] }), CORS, log, OPTS);
    assert(!r.ok, `${rol} no debe pasar la guarda`);
    if (!r.ok) assertEquals(r.res.status, 403);
  }
});

Deno.test("rol con permiso CxP y contador disponible: autoriza y devuelve la org", async () => {
  for (const rol of ["contador", "auxiliar_contable", "admin_org", "super_admin"]) {
    const r = await autorizarCxp(fakeAuth({ orgId: "org-1", roles: [rol] }), CORS, log, OPTS);
    assert(r.ok, `${rol} debe pasar la guarda`);
    if (r.ok) assertEquals(r.orgId, "org-1");
  }
});

Deno.test("rate limit por usuario: 429 con Retry-After", async () => {
  const r = await autorizarCxp(
    fakeAuth({
      orgId: "org-1",
      roles: ["contador"],
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
      orgId: "org-1",
      roles: ["contador"],
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
      orgId: "org-1",
      roles: ["contador"],
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

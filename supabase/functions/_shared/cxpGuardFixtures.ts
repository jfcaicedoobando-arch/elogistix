/**
 * Fixtures compartidos de las pruebas de la guarda de CxP (membresía, rol y
 * rate limit). Extraídos del archivo de pruebas en v13.823.13 para respetar el
 * tope de 250 líneas por archivo; el comportamiento simulado no cambia.
 */
// deno-lint-ignore-file no-import-prefix
import { autorizarCxp } from "./cxpGuard.ts";
import type { AuthContext } from "./auth.ts";

export type RpcResp = { data: unknown; error: { message: string } | null };

export interface FakeOpts {
  memberships?: Record<string, string>;
  globalRoles?: string[];
  rpc?: (name: string, args: Record<string, unknown>) => RpcResp;
}

export const llamadasRpc: { name: string; args: Record<string, unknown> }[] = [];

export function fakeAuth(opts: FakeOpts): AuthContext {
  const memberships = opts.memberships ?? {};
  const globalRoles = opts.globalRoles ?? [];
  const adminClient = {
    from(tabla: string) {
      const filtros: Record<string, string> = {};
      const chain = {
        select(_cols: string) {
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
            return Promise.resolve({
              data: rolOrg ? { role: rolOrg } : null,
              error: null,
            });
          }
          if (tabla === "user_roles" && filtros.role === "super_admin") {
            return Promise.resolve({
              data: globalRoles.includes("super_admin")
                ? { role: "super_admin" }
                : null,
              error: null,
            });
          }
          if (tabla === "user_roles" && filtros.roles) {
            const permitidos = filtros.roles.split(",");
            const role = globalRoles.find((r) => permitidos.includes(r));
            return Promise.resolve({
              data: role ? { role } : null,
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
  return {
    userId: "u-1",
    authHeader: "Bearer x",
    anonClient: adminClient,
    adminClient,
  } as unknown as AuthContext;
}

export const log = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  setUserId: () => undefined,
  setOrganizationId: () => undefined,
  finish: () => undefined,
} as unknown as Parameters<typeof autorizarCxp>[2];

export const CORS = { "Access-Control-Allow-Origin": "*" };
export const ORG_A = "11111111-1111-4111-8111-111111111111";
export const ORG_B = "22222222-2222-4222-8222-222222222222";
export const OPTS = {
  organizationId: ORG_B,
  fn: "prueba-cxp",
  rlUsuario: { windowSeconds: 3600, max: 5 },
  rlOrg: { windowSeconds: 3600, max: 10 },
};

/**
 * Tests del helper `resolveFacturapiKey` — verifica multi-tenant routing,
 * fallback legacy y errores claros.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveFacturapiKey } from "./facturapiAuth.ts";

interface Row {
  ambiente: string;
  api_key_sandbox_secret_name: string | null;
  api_key_live_secret_name: string | null;
  api_key_sandbox_vault_id: string | null;
  api_key_live_vault_id: string | null;
  facturapi_org_id: string | null;
}

function makeSupabase(row: Row | null, rpcImpl?: (fn: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: unknown }>) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: () => Promise.resolve({ data: row, error: null }),
              };
            },
          };
        },
      };
    },
    rpc: rpcImpl ?? (() => Promise.resolve({ data: null, error: null })),
  };
}

function cleanupEnv() {
  Deno.env.delete("FACTURAPI_KEY");
  Deno.env.delete("FACTURAPI_KEY_ORG1_SANDBOX");
  Deno.env.delete("FACTURAPI_KEY_ORG1_LIVE");
}

Deno.test("resolveFacturapiKey: usa secret sandbox cuando ambiente=sandbox", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY_ORG1_SANDBOX", "sk_test_abc");
  const sb = makeSupabase({
    ambiente: "sandbox",
    api_key_sandbox_secret_name: "FACTURAPI_KEY_ORG1_SANDBOX",
    api_key_live_secret_name: "FACTURAPI_KEY_ORG1_LIVE",
    api_key_sandbox_vault_id: null,
    api_key_live_vault_id: null,
    facturapi_org_id: "fapi_org_1",
  });
  const res = await resolveFacturapiKey(sb, "org-1");
  if (!res.ok) throw new Error("esperaba ok");
  assertEquals(res.data.apiKey, "sk_test_abc");
  assertEquals(res.data.ambiente, "sandbox");
  assertEquals(res.data.legacy, false);
  cleanupEnv();
});

Deno.test("resolveFacturapiKey: usa secret live cuando ambiente=live", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY_ORG1_LIVE", "sk_live_xyz");
  const sb = makeSupabase({
    ambiente: "live",
    api_key_sandbox_secret_name: "FACTURAPI_KEY_ORG1_SANDBOX",
    api_key_live_secret_name: "FACTURAPI_KEY_ORG1_LIVE",
    api_key_sandbox_vault_id: null,
    api_key_live_vault_id: null,
    facturapi_org_id: "fapi_org_1",
  });
  const res = await resolveFacturapiKey(sb, "org-1");
  if (!res.ok) throw new Error("esperaba ok");
  assertEquals(res.data.apiKey, "sk_live_xyz");
  assertEquals(res.data.ambiente, "live");
  cleanupEnv();
});

Deno.test("resolveFacturapiKey: 412 si la org no tiene fila ni FACTURAPI_KEY global", async () => {
  cleanupEnv();
  const sb = makeSupabase(null);
  const res = await resolveFacturapiKey(sb, "org-sin-config");
  if (res.ok) throw new Error("esperaba error");
  assertEquals(res.data.error, "org_facturapi_not_configured");
  assertEquals(res.data.status, 412);
});

Deno.test("resolveFacturapiKey: fallback legacy a FACTURAPI_KEY global", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY", "sk_legacy_999");
  const sb = makeSupabase(null);
  const res = await resolveFacturapiKey(sb, "org-1");
  if (!res.ok) throw new Error("esperaba ok (legacy)");
  assertEquals(res.data.apiKey, "sk_legacy_999");
  assertEquals(res.data.legacy, true);
  cleanupEnv();
});

Deno.test("resolveFacturapiKey: 500 si el secret name existe en la tabla pero el env var falta", async () => {
  cleanupEnv();
  const sb = makeSupabase({
    ambiente: "sandbox",
    api_key_sandbox_secret_name: "FACTURAPI_KEY_ORG1_SANDBOX",
    api_key_live_secret_name: null,
    api_key_sandbox_vault_id: null,
    api_key_live_vault_id: null,
    facturapi_org_id: null,
  });
  const res = await resolveFacturapiKey(sb, "org-1");
  if (res.ok) throw new Error("esperaba error");
  assertEquals(res.data.error, "missing_facturapi_key");
  assertEquals(res.data.status, 500);
});

Deno.test("resolveFacturapiKey: 412 cuando el ambiente activo no tiene secret_name asignado", async () => {
  cleanupEnv();
  const sb = makeSupabase({
    ambiente: "live",
    api_key_sandbox_secret_name: "FACTURAPI_KEY_ORG1_SANDBOX",
    api_key_live_secret_name: null,
    api_key_sandbox_vault_id: null,
    api_key_live_vault_id: null,
    facturapi_org_id: null,
  });
  const res = await resolveFacturapiKey(sb, "org-1");
  if (res.ok) throw new Error("esperaba error");
  assertEquals(res.data.error, "org_facturapi_not_configured");
  assertEquals(res.data.status, 412);
});

Deno.test("resolveFacturapiKey: usa RPC vault cuando vault_id está presente", async () => {
  cleanupEnv();
  const sb = makeSupabase(
    {
      ambiente: "sandbox",
      api_key_sandbox_secret_name: null,
      api_key_live_secret_name: null,
      api_key_sandbox_vault_id: "11111111-1111-1111-1111-111111111111",
      api_key_live_vault_id: null,
      facturapi_org_id: "fapi_org_1",
    },
    (fn, args) => {
      if (fn === "get_facturapi_api_key_internal" && args.p_ambiente === "sandbox") {
        return Promise.resolve({ data: "sk_test_from_vault", error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  );
  const res = await resolveFacturapiKey(sb, "org-1");
  if (!res.ok) throw new Error("esperaba ok");
  assertEquals(res.data.apiKey, "sk_test_from_vault");
  assertEquals(res.data.ambiente, "sandbox");
  assertEquals(res.data.legacy, false);
});

Deno.test("resolveFacturapiKey: si el RPC vault falla, cae al fallback env", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY_ORG1_SANDBOX", "sk_test_env_fallback");
  const sb = makeSupabase(
    {
      ambiente: "sandbox",
      api_key_sandbox_secret_name: "FACTURAPI_KEY_ORG1_SANDBOX",
      api_key_live_secret_name: null,
      api_key_sandbox_vault_id: "11111111-1111-1111-1111-111111111111",
      api_key_live_vault_id: null,
      facturapi_org_id: null,
    },
    () => Promise.resolve({ data: null, error: { message: "rpc failed" } }),
  );
  const res = await resolveFacturapiKey(sb, "org-1");
  if (!res.ok) throw new Error("esperaba ok (fallback env)");
  assertEquals(res.data.apiKey, "sk_test_env_fallback");
  cleanupEnv();
});

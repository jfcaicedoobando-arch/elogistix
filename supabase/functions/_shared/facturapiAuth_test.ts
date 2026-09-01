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
  Deno.env.delete("LEGACY_FACTURAPI_ORG_ID");
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

Deno.test("resolveFacturapiKey: SIN LEGACY_FACTURAPI_ORG_ID, ninguna org usa FACTURAPI_KEY global (fail-closed)", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY", "sk_legacy_999");
  const sb = makeSupabase(null);
  const res = await resolveFacturapiKey(sb, "org-1");
  if (res.ok) throw new Error("esperaba error (fail-closed)");
  assertEquals(res.data.error, "org_facturapi_not_configured");
  assertEquals(res.data.status, 412);
  cleanupEnv();
});

Deno.test("resolveFacturapiKey: legacy SÓLO aplica con coincidencia EXACTA de LEGACY_FACTURAPI_ORG_ID", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY", "sk_legacy_999");
  Deno.env.set("LEGACY_FACTURAPI_ORG_ID", "org-legacy");
  const sb = makeSupabase(null);

  const okRes = await resolveFacturapiKey(sb, "org-legacy");
  if (!okRes.ok) throw new Error("esperaba ok (legacy exacto)");
  assertEquals(okRes.data.apiKey, "sk_legacy_999");
  assertEquals(okRes.data.legacy, true);

  const otraOrg = await resolveFacturapiKey(sb, "org-otra-distinta");
  if (otraOrg.ok) throw new Error("otra org NUNCA debe usar el fallback legacy");
  assertEquals(otraOrg.data.error, "org_facturapi_not_configured");
  cleanupEnv();
});

Deno.test("resolveFacturapiKey: dos orgs — la configurada usa su key propia, la otra jamás toca la global", async () => {
  cleanupEnv();
  Deno.env.set("FACTURAPI_KEY", "sk_global_never_used");
  Deno.env.set("FACTURAPI_KEY_ORG1_SANDBOX", "sk_org1_own_key");
  const sbOrg1 = makeSupabase({
    ambiente: "sandbox",
    api_key_sandbox_secret_name: "FACTURAPI_KEY_ORG1_SANDBOX",
    api_key_live_secret_name: null,
    api_key_sandbox_vault_id: null,
    api_key_live_vault_id: null,
    facturapi_org_id: "fapi_org_1",
  });
  const resOrg1 = await resolveFacturapiKey(sbOrg1, "org-1");
  if (!resOrg1.ok) throw new Error("esperaba ok");
  assertEquals(resOrg1.data.apiKey, "sk_org1_own_key");
  assertEquals(resOrg1.data.legacy, false);

  const sbOrgSinConfig = makeSupabase(null);
  const resOrg2 = await resolveFacturapiKey(sbOrgSinConfig, "org-2-sin-config");
  if (resOrg2.ok) throw new Error("esperaba error (fail-closed, sin LEGACY_FACTURAPI_ORG_ID que coincida)");
  assertEquals(resOrg2.data.error, "org_facturapi_not_configured");
  cleanupEnv();
});

Deno.test("resolveFacturapiKey: mensaje al cliente es genérico y no expone nombres de secrets", async () => {
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
  if (res.data.message.includes("FACTURAPI_KEY_ORG1_SANDBOX")) {
    throw new Error("el mensaje al cliente no debe exponer el nombre del secret");
  }
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
  cleanupEnv();
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
  cleanupEnv();
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

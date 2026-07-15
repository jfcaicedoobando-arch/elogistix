// Edge function: provisiona (o actualiza) los usuarios usados por la suite E2E
// de Playwright y asegura su rol + membresía correspondiente.
//
// - `admin`  → user_roles.role = 'admin' + organization_members(org_id)
// - `portal` → user_roles.role = 'cliente' + client_users(cliente_id, org_id)
//
// Protegido por header `x-e2e-secret` que debe igualar el secreto
// `E2E_PROVISION_SECRET` (runtime secret del proyecto). Nunca expongas este
// endpoint sin el header — usa `service_role` internamente para crear usuarios,
// resetear passwords y bypass RLS al asignar roles.
//
// Idempotente: si el usuario ya existe, sólo actualiza password/rol.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

type ProvisionPayload = {
  admin?: { email: string; password: string };
  portal?: { email: string; password: string };
  organization_id?: string;
  cliente_id?: string;
};

type AdminClient = ReturnType<typeof createClient>;

type UserResult = {
  email: string;
  user_id: string;
  created: boolean;
  role: string;
  verified: boolean;
  checks: {
    user_role_ok: boolean;
    org_member_ok?: boolean;
    client_user_ok?: boolean;
  };
};

Deno.serve(async (req) => {
  const guarded = await guard(req);
  if (guarded instanceof Response) return guarded;
  const { payload } = guarded;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const orgResult = await resolveOrgId(admin, payload);
    if (orgResult instanceof Response) return orgResult;
    const orgId = orgResult;

    const clienteResult = await resolveClienteId(admin, payload, orgId);
    if (clienteResult instanceof Response) return clienteResult;
    const clienteId = clienteResult;

    const results: UserResult[] = [];

    const adminRes = await provisionAdmin(admin, payload, orgId);
    if (adminRes) results.push(adminRes);

    const portalRes = await provisionPortal(admin, payload, clienteId, orgId);
    if (portalRes) results.push(portalRes);

    const allVerified = results.every((r) => r.verified);
    return json(
      {
        ok: allVerified,
        organization_id: orgId,
        cliente_id: clienteId,
        users: results,
        ...(allVerified ? {} : { error: "verification_failed" }),
      },
      allVerified ? 200 : 500,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: "provision_failed", message }, 500);
  }
});

// -----------------------------------------------------------------------------
// Guardas HTTP + parseo de payload.

async function guard(
  req: Request,
): Promise<Response | { payload: ProvisionPayload }> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const expected = Deno.env.get("E2E_PROVISION_SECRET");
  if (!expected) {
    return json({ error: "e2e_provision_secret_not_configured" }, 500);
  }
  if (req.headers.get("x-e2e-secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const payload = (await req.json()) as ProvisionPayload;
    return { payload };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
}

// -----------------------------------------------------------------------------
// Resolución de organización y cliente.

async function resolveOrgId(
  admin: AdminClient,
  payload: ProvisionPayload,
): Promise<string | Response> {
  if (payload.organization_id) return payload.organization_id;
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return json({ error: "no_organization_found" }, 400);
  return data.id as string;
}

async function resolveClienteId(
  admin: AdminClient,
  payload: ProvisionPayload,
  orgId: string,
): Promise<string | null | Response> {
  if (payload.cliente_id) return payload.cliente_id;
  if (!payload.portal) return null;
  const { data, error } = await admin
    .from("clientes")
    .select("id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return json({ error: "no_cliente_found_for_org", organization_id: orgId }, 400);
  }
  return data.id as string;
}

// -----------------------------------------------------------------------------
// Flujos de provisioning por rol.

async function provisionAdmin(
  admin: AdminClient,
  payload: ProvisionPayload,
  orgId: string,
): Promise<UserResult | null> {
  if (!payload.admin?.email || !payload.admin.password) return null;
  const r = await upsertUser(admin, payload.admin.email, payload.admin.password);
  await upsertRole(admin, r.user_id, "admin");
  await upsertOrgMember(admin, r.user_id, orgId, "admin");
  const checks = await verifyAdmin(admin, r.user_id, orgId);
  return {
    ...r,
    role: "admin",
    verified: checks.user_role_ok && checks.org_member_ok === true,
    checks,
  };
}

async function provisionPortal(
  admin: AdminClient,
  payload: ProvisionPayload,
  clienteId: string | null,
  orgId: string,
): Promise<UserResult | null> {
  if (!payload.portal?.email || !payload.portal.password || !clienteId) return null;
  const r = await upsertUser(admin, payload.portal.email, payload.portal.password);
  await upsertRole(admin, r.user_id, "cliente");
  await upsertClientUser(admin, r.user_id, clienteId, orgId);
  const checks = await verifyPortal(admin, r.user_id, clienteId, orgId);
  return {
    ...r,
    role: "cliente",
    verified: checks.user_role_ok && checks.client_user_ok === true,
    checks,
  };
}

// -----------------------------------------------------------------------------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upsertUser(
  admin: AdminClient,
  email: string,
  password: string,
): Promise<{ email: string; user_id: string; created: boolean }> {
  const target = email.toLowerCase();
  let found: { id: string } | null = null;
  for (let page = 1; page <= 20 && !found; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) found = { id: hit.id };
    if (data.users.length < 200) break;
  }

  if (found) {
    const { error } = await admin.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return { email, user_id: found.id, created: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { email, user_id: data.user!.id, created: true };
}

async function upsertRole(admin: AdminClient, userId: string, role: string) {
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) throw error;
}

async function upsertOrgMember(
  admin: AdminClient,
  userId: string,
  orgId: string,
  role: string,
) {
  const { error } = await admin
    .from("organization_members")
    .upsert(
      { user_id: userId, organization_id: orgId, role },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

async function upsertClientUser(
  admin: AdminClient,
  userId: string,
  clienteId: string,
  orgId: string,
) {
  const { error } = await admin
    .from("client_users")
    .upsert(
      { user_id: userId, cliente_id: clienteId, organization_id: orgId },
      { onConflict: "user_id,cliente_id" },
    );
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Verificación post-upsert: releemos las tablas para confirmar rol + asociación.

async function verifyAdmin(
  admin: AdminClient,
  userId: string,
  orgId: string,
): Promise<{ user_role_ok: boolean; org_member_ok: boolean }> {
  const [roleRes, memberRes] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    admin
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);
  return {
    user_role_ok: !roleRes.error && roleRes.data?.role === "admin",
    org_member_ok:
      !memberRes.error &&
      memberRes.data?.organization_id === orgId &&
      memberRes.data?.role === "admin",
  };
}

async function verifyPortal(
  admin: AdminClient,
  userId: string,
  clienteId: string,
  orgId: string,
): Promise<{ user_role_ok: boolean; client_user_ok: boolean }> {
  const [roleRes, cuRes] = await Promise.all([
    admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "cliente")
      .maybeSingle(),
    admin
      .from("client_users")
      .select("cliente_id, organization_id")
      .eq("user_id", userId)
      .eq("cliente_id", clienteId)
      .maybeSingle(),
  ]);
  return {
    user_role_ok: !roleRes.error && roleRes.data?.role === "cliente",
    client_user_ok:
      !cuRes.error &&
      cuRes.data?.cliente_id === clienteId &&
      cuRes.data?.organization_id === orgId,
  };
}

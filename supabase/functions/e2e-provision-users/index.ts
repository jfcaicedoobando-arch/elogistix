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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // Guardia: secreto compartido
  const expected = Deno.env.get("E2E_PROVISION_SECRET");
  if (!expected) {
    return json({ error: "e2e_provision_secret_not_configured" }, 500);
  }
  const provided = req.headers.get("x-e2e-secret");
  if (provided !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  let payload: ProvisionPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Resolver organización (usa la primera si no se especifica).
    let orgId = payload.organization_id ?? null;
    if (!orgId) {
      const { data: firstOrg, error: orgErr } = await admin
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (orgErr) throw orgErr;
      if (!firstOrg) return json({ error: "no_organization_found" }, 400);
      orgId = firstOrg.id;
    }

    // Resolver cliente para el portal (usa el primero de la org si no se especifica).
    let clienteId = payload.cliente_id ?? null;
    if (payload.portal && !clienteId) {
      const { data: firstCliente, error: clientErr } = await admin
        .from("clientes")
        .select("id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (clientErr) throw clientErr;
      if (!firstCliente) {
        return json({ error: "no_cliente_found_for_org", organization_id: orgId }, 400);
      }
      clienteId = firstCliente.id;
    }

    const results: UserResult[] = [];

    if (payload.admin?.email && payload.admin.password) {
      const r = await upsertUser(admin, payload.admin.email, payload.admin.password);
      await upsertRole(admin, r.user_id, "admin");
      await upsertOrgMember(admin, r.user_id, orgId, "admin");
      const checks = await verifyAdmin(admin, r.user_id, orgId);
      results.push({
        ...r,
        role: "admin",
        verified: checks.user_role_ok && checks.org_member_ok === true,
        checks,
      });
    }

    if (payload.portal?.email && payload.portal.password && clienteId) {
      const r = await upsertUser(admin, payload.portal.email, payload.portal.password);
      await upsertRole(admin, r.user_id, "cliente");
      await upsertClientUser(admin, r.user_id, clienteId, orgId);
      const checks = await verifyPortal(admin, r.user_id, clienteId, orgId);
      results.push({
        ...r,
        role: "cliente",
        verified: checks.user_role_ok && checks.client_user_ok === true,
        checks,
      });
    }

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function upsertUser(
  admin: ReturnType<typeof createClient>,
  email: string,
  password: string,
): Promise<{ email: string; user_id: string; created: boolean }> {
  // Búsqueda paginada por email (auth.admin no expone filtro directo).
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

async function upsertRole(
  admin: ReturnType<typeof createClient>,
  userId: string,
  role: string,
) {
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) throw error;
}

async function upsertOrgMember(
  admin: ReturnType<typeof createClient>,
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
  admin: ReturnType<typeof createClient>,
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
  admin: ReturnType<typeof createClient>,
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
  admin: ReturnType<typeof createClient>,
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

// Helpers de provisioning para la edge function `e2e-provision-users`.
// Extraídos del handler para mantener el archivo principal bajo el límite de
// líneas del linter y su complejidad ciclomática dentro del umbral.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ProvisionPayload = {
  admin?: { email: string; password: string };
  portal?: { email: string; password: string };
  organization_id?: string;
  cliente_id?: string;
};

export type AdminClient = ReturnType<typeof createClient>;

export type UserResult = {
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

export function jsonResponse(body: unknown, status: number, corsHeaders: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function resolveOrgId(
  admin: AdminClient,
  payload: ProvisionPayload,
): Promise<string | null> {
  if (payload.organization_id) return payload.organization_id;
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

export async function resolveClienteId(
  admin: AdminClient,
  payload: ProvisionPayload,
  orgId: string,
): Promise<string | null> {
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
  return (data?.id as string | undefined) ?? null;
}

export async function provisionAdmin(
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

export async function provisionPortal(
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

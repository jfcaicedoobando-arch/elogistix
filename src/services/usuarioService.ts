import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types/types";

export interface UserRow {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

interface OrgMemberRow {
  user_id: string;
  role: string;
  created_at: string | null;
}

interface ListUsersRow {
  id: string;
  email: string;
  created_at: string;
}

/**
 * Lista los miembros de la organización combinando organization_members
 * con la edge function list-users para resolver emails y created_at de auth.
 */
export async function fetchUsuariosOrganizacion(): Promise<UserRow[]> {
  const { data: membersData, error: membersError } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .order("created_at", { ascending: false });

  if (membersError) throw membersError;
  const members = (membersData ?? []) as OrgMemberRow[];

  let emailMap: Record<string, { email: string; created_at: string }> = {};
  try {
    const { data: usersData, error: fnError } = await supabase.functions.invoke("list-users");
    if (!fnError && Array.isArray(usersData)) {
      (usersData as ListUsersRow[]).forEach((u) => {
        emailMap[u.id] = { email: u.email, created_at: u.created_at };
      });
    }
  } catch {
    // Si la edge function falla, mostramos el user_id como fallback.
  }

  return members.map((m) => ({
    user_id: m.user_id,
    email: emailMap[m.user_id]?.email || m.user_id,
    role: m.role as AppRole,
    created_at: emailMap[m.user_id]?.created_at || m.created_at || "",
  }));
}

export async function updateUserRole(userId: string, newRole: AppRole): Promise<void> {
  const { error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteUserViaEdgeFunction(userId: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { user_id: userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export interface CreateUserParams {
  email: string;
  password: string;
  role: string;
  orgId?: string;
}

export interface CreateUserResponse {
  user?: { id: string };
  error?: string;
  [key: string]: unknown;
}

export async function createUserViaEdgeFunction(
  params: CreateUserParams,
): Promise<CreateUserResponse> {
  const token = await getAuthToken();
  const res = await supabase.functions.invoke("create-user", {
    body: { email: params.email, password: params.password, role: params.role },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.error) throw new Error(res.error.message || "Error al crear usuario");
  const body = res.data as CreateUserResponse;
  if (body?.error) throw new Error(body.error);

  if (params.orgId && body?.user?.id) {
    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: params.orgId,
      user_id: body.user.id,
      role: params.role as "admin" | "operador" | "viewer",
    });
    if (memberError) {
      throw new Error(
        `Usuario creado, pero no se pudo asignar a la organización: ${memberError.message}`,
      );
    }
  }

  return body;
}

export async function deleteUserViaEdgeFunctionAuth(userId: string): Promise<unknown> {
  const token = await getAuthToken();
  const res = await supabase.functions.invoke("delete-user", {
    body: { user_id: userId },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.error) throw new Error(res.error.message || "Error al eliminar usuario");
  const body = res.data as { error?: string };
  if (body?.error) throw new Error(body.error);
  return body;
}

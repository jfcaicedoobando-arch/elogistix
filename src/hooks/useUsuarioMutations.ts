import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errorUtils";

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (params: {
      email: string;
      password: string;
      role: string;
      orgId?: string;
    }) => {
      const token = await getAuthToken();
      const res = await supabase.functions.invoke("create-user", {
        body: { email: params.email, password: params.password, role: params.role },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message || "Error al crear usuario");
      const body = res.data;
      if (body?.error) throw new Error(body.error);

      if (params.orgId && body?.user?.id) {
        const { error: memberError } = await supabase.from("organization_members").insert({
          organization_id: params.orgId,
          user_id: body.user.id,
          role: params.role as "admin" | "operador" | "viewer",
        });
        if (memberError) {
          throw new Error(`Usuario creado, pero no se pudo asignar a la organización: ${memberError.message}`);
        }
      }

      return body;
    },
  });
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const token = await getAuthToken();
      const res = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message || "Error al eliminar usuario");
      const body = res.data;
      if (body?.error) throw new Error(body.error);
      return body;
    },
  });
}

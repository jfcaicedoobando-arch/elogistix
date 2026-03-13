import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

type AppRole = Enums<'app_role'>;

export interface UserRow {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

const QUERY_KEY = ['usuarios'];

export function useUsuarios() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<UserRow[]> => {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .order('user_id');

      if (rolesError) throw rolesError;

      let emailMap: Record<string, { email: string; created_at: string }> = {};
      try {
        const { data: usersData, error: fnError } = await supabase.functions.invoke('list-users');
        if (!fnError && Array.isArray(usersData)) {
          (usersData as { id: string; email: string; created_at: string }[]).forEach((usuario) => {
            emailMap[usuario.id] = { email: usuario.email, created_at: usuario.created_at };
          });
        }
      } catch {
        // If edge function fails, we'll show user_id instead
      }

      return (rolesData ?? []).map((rolUsuario) => ({
        user_id: rolUsuario.user_id,
        email: emailMap[rolUsuario.user_id]?.email || rolUsuario.user_id,
        role: rolUsuario.role as AppRole,
        created_at: emailMap[rolUsuario.user_id]?.created_at || '',
      }));
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

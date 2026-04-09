import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/data/types';

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
      // Get organization members for the current org
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, role, created_at')
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;

      // Get emails from list-users edge function
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

      return (membersData ?? []).map((member) => ({
        user_id: member.user_id,
        email: emailMap[member.user_id]?.email || member.user_id,
        role: member.role as AppRole,
        created_at: emailMap[member.user_id]?.created_at || member.created_at || '',
      }));
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

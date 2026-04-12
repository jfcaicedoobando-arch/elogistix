import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

// ─── Types ───────────────────────────────────────────────
export interface AdminOrgStats {
  totalOrgs: number;
  totalUsers: number;
  totalEmbarques: number;
  totalCotizaciones: number;
}

export interface GlobalUserRow {
  user_id: string;
  email: string;
  org_nombre: string;
  role: string;
}

export interface OrgRow {
  id: string;
  nombre: string;
  rfc: string;
  plan: string;
  activo: boolean;
  created_at: string;
}

// ─── Dashboard Stats ─────────────────────────────────────
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: [...queryKeys.admin.organizations, 'stats'],
    queryFn: async (): Promise<AdminOrgStats> => {
      const [orgs, members, embarques, cotizaciones] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }),
        supabase.from('embarques').select('id', { count: 'exact', head: true }),
        supabase.from('cotizaciones').select('id', { count: 'exact', head: true }),
      ]);
      return {
        totalOrgs: orgs.count ?? 0,
        totalUsers: members.count ?? 0,
        totalEmbarques: embarques.count ?? 0,
        totalCotizaciones: cotizaciones.count ?? 0,
      };
    },
  });
}

// ─── Global Users ────────────────────────────────────────
export function useAdminGlobalUsers() {
  return useQuery({
    queryKey: queryKeys.admin.allUsers,
    queryFn: async (): Promise<GlobalUserRow[]> => {
      const { data: members, error } = await supabase
        .from('organization_members')
        .select('user_id, role, organization_id')
        .order('user_id');
      if (error) throw error;

      const { data: orgs } = await supabase.from('organizations').select('id, nombre');
      const orgMap: Record<string, string> = {};
      (orgs ?? []).forEach((o) => { orgMap[o.id] = o.nombre; });

      let emailMap: Record<string, string> = {};
      try {
        const { data: usersData } = await supabase.functions.invoke('list-users');
        if (Array.isArray(usersData)) {
          usersData.forEach((u: { id: string; email: string }) => { emailMap[u.id] = u.email; });
        }
      } catch { /* edge function may not be available */ }

      return (members ?? []).map((m) => ({
        user_id: m.user_id,
        email: emailMap[m.user_id] || m.user_id,
        org_nombre: orgMap[m.organization_id] || m.organization_id,
        role: m.role,
      }));
    },
  });
}

// ─── Organizations List ──────────────────────────────────
export function useAdminOrganizations() {
  return useQuery({
    queryKey: queryKeys.admin.organizations,
    queryFn: async (): Promise<OrgRow[]> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('nombre');
      if (error) throw error;
      return data as unknown as OrgRow[];
    },
  });
}

// ─── Create Organization ─────────────────────────────────
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ nombre, rfc }: { nombre: string; rfc: string }) => {
      const { error } = await supabase.from('organizations').insert({ nombre, rfc });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.organizations });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchAdminDashboardStats,
  fetchAdminGlobalUsers,
  fetchAdminOrganizations,
  createOrganization,
  type AdminOrgStats,
  type GlobalUserRow,
  type OrgRow,
} from '@/services/adminServices';

export type { AdminOrgStats, GlobalUserRow, OrgRow };

// ─── Dashboard Stats ─────────────────────────────────────
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: [...queryKeys.admin.organizations, 'stats'],
    queryFn: fetchAdminDashboardStats,
  });
}

// ─── Global Users ────────────────────────────────────────
export function useAdminGlobalUsers() {
  return useQuery({
    queryKey: queryKeys.admin.allUsers,
    queryFn: fetchAdminGlobalUsers,
  });
}

// ─── Organizations List ──────────────────────────────────
export function useAdminOrganizations() {
  return useQuery({
    queryKey: queryKeys.admin.organizations,
    queryFn: fetchAdminOrganizations,
  });
}

// ─── Create Organization ─────────────────────────────────
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.organizations });
    },
  });
}

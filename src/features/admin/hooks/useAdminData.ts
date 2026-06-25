import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import {
  fetchAdminDashboardStats,
  fetchAdminOrganizations,
  fetchAdminOrgActivity,
  fetchAdminRecentOrgs,
  createOrganization,
  type AdminOrgStats,
  type AdminOrgActivity,
  type AdminRecentOrg,
  type GlobalUserRow,
  type OrgRow,
} from '@/features/admin/services';
import { notifyError, notifySuccess } from '@/components/shared/utils/appFeedback';

export type { AdminOrgStats, AdminOrgActivity, AdminRecentOrg, GlobalUserRow, OrgRow };

// ─── Dashboard Stats ─────────────────────────────────────
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: queryKeys.admin.organizationsStats,
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

// ─── Org Activity (embarques + cotizaciones por org) ────
export function useAdminOrgActivity() {
  return useQuery({
    queryKey: queryKeys.admin.orgActivity,
    queryFn: fetchAdminOrgActivity,
  });
}

// ─── Últimas organizaciones creadas ──────────────────────
export function useAdminRecentOrgs(limit = 5) {
  return useQuery({
    queryKey: queryKeys.admin.recentOrgsList(limit),
    queryFn: () => fetchAdminRecentOrgs(limit),
  });
}

// ─── Create Organization ─────────────────────────────────
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.organizations });
      notifySuccess(undefined, { title: "Organización creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear organización: ${error.message}`, error, method: "CREATE_ORGANIZATION" });
    },
  });
}

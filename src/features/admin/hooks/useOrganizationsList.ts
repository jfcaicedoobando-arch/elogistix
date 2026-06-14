import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchOrganizationsList } from "@/services/admin";

/**
 * Lista de organizaciones (id + nombre) para selectores de admin.
 */
export function useOrganizationsList(enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.organizationsList,
    queryFn: fetchOrganizationsList,
    enabled,
  });
}

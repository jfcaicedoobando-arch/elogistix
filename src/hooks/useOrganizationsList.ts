import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { fetchOrganizationsList } from "@/services/adminServices";

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

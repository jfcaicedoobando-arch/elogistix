import { useOrganization } from "@/contexts/OrganizationContext";

/**
 * Returns the active organization ID for query filtering.
 * All list queries should include this in their query key and use it to filter.
 */
export function useOrgFilter() {
  const { organizationId } = useOrganization();
  return { organizationId };
}

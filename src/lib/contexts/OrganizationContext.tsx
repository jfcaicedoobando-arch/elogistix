import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { listActiveOrganizations } from "@/features/admin/services/organization";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";
import { syncSentryActiveOrg } from "@/lib/observability/sentry/user";

export interface Organization {
  id: string;
  nombre: string;
  rfc: string;
  logo_url: string | null;
  plan: string;
  activo: boolean;
}

interface OrganizationContextType {
  organizationId: string | null;
  organization: Organization | null;
  organizations: Organization[];
  setActiveOrganization: (id: string) => void;
  /** Sale del tenant activo (sólo super admin) y limpia la preferencia guardada. */
  clearActiveOrganization: () => void;
  isSuperAdmin: boolean;
  /** true cuando es super admin y no ha elegido ninguna organización todavía. */
  requiereSeleccionOrg: boolean;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizationId: null,
  organization: null,
  organizations: [],
  setActiveOrganization: () => {},
  clearActiveOrganization: () => {},
  isSuperAdmin: false,
  requiereSeleccionOrg: false,
  loading: true,
});


export const useOrganization = () => useContext(OrganizationContext);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, role, organizationId: cachedOrgId, organization: cachedOrg, loading: authLoading } = useAuth();
  const [superAdminOrgs, setSuperAdminOrgs] = useState<Organization[]>([]);
  const [superAdminActiveId, setSuperAdminActiveId] = useState<string | null>(null);
  const [loadingSA, setLoadingSA] = useState(false);
  const queryClient = useQueryClient();

  const isSuperAdmin = role === "super_admin";

  // Super-admin needs the full org list — only fetched when applicable
  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    let cancelled = false;
    setLoadingSA(true);
    (async () => {
      const orgList = await listActiveOrganizations<Organization>();
      if (cancelled) return;
      setSuperAdminOrgs(orgList);
      const stored = safeLocalStorage.getItem(STORAGE_KEYS.superAdminActiveOrg);
      // R7-FIX4: sin preferencia guardada, aterrizar en la organización propia
      // del super-admin (la de su membresía) antes que en la primera alfabética.
      const propia = cachedOrgId && orgList.find(o => o.id === cachedOrgId) ? cachedOrgId : null;
      const activeId = stored && orgList.find(o => o.id === stored)
        ? stored
        : propia ?? orgList[0]?.id ?? null;
      setSuperAdminActiveId(activeId);
      setLoadingSA(false);
    })();
    return () => { cancelled = true; };
  }, [user, isSuperAdmin, cachedOrgId]);

  const setActiveOrganization = useCallback((id: string) => {
    if (isSuperAdmin) {
      setSuperAdminActiveId(id);
      safeLocalStorage.setItem(STORAGE_KEYS.superAdminActiveOrg, id);
      // R6-FIX4: al cambiar de tenant, ninguna caché previa sigue siendo válida.
      queryClient.clear();
    }
  }, [isSuperAdmin, queryClient]);


  const value = useMemo<OrganizationContextType>(() => {
    if (isSuperAdmin) {
      const active = superAdminOrgs.find(o => o.id === superAdminActiveId) ?? null;
      return {
        organizationId: superAdminActiveId,
        organization: active,
        organizations: superAdminOrgs,
        setActiveOrganization,
        isSuperAdmin: true,
        loading: authLoading || loadingSA,
      };
    }
    // Regular user — reuse cached organization from AuthContext (no extra round-trips)
    const orgFromCache: Organization | null = cachedOrg ? {
      id: cachedOrg.id,
      nombre: cachedOrg.nombre,
      rfc: cachedOrg.rfc ?? "",
      logo_url: cachedOrg.logo_url,
      plan: cachedOrg.plan ?? "basic",
      activo: cachedOrg.activo ?? true,
    } : null;
    return {
      organizationId: cachedOrgId,
      organization: orgFromCache,
      organizations: orgFromCache ? [orgFromCache] : [],
      setActiveOrganization,
      isSuperAdmin: false,
      loading: authLoading,
    };
  }, [isSuperAdmin, superAdminOrgs, superAdminActiveId, cachedOrgId, cachedOrg, authLoading, loadingSA, setActiveOrganization]);

  // Refresca el tag de Sentry cuando cambia la organización efectiva (super-admin
  // impersonando otro tenant o usuario regular cargando su org). Sin esto, los
  // eventos posteriores al cambio quedarían tagueados con el org anterior.
  useEffect(() => {
    syncSentryActiveOrg(value.organizationId);
  }, [value.organizationId]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

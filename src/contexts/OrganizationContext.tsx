import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fromDb } from "@/lib/supabase/cast";

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
  isSuperAdmin: boolean;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizationId: null,
  organization: null,
  organizations: [],
  setActiveOrganization: () => {},
  isSuperAdmin: false,
  loading: true,
});

export const useOrganization = () => useContext(OrganizationContext);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, role, organizationId: cachedOrgId, organization: cachedOrg, loading: authLoading } = useAuth();
  const [superAdminOrgs, setSuperAdminOrgs] = useState<Organization[]>([]);
  const [superAdminActiveId, setSuperAdminActiveId] = useState<string | null>(null);
  const [loadingSA, setLoadingSA] = useState(false);

  const isSuperAdmin = role === "super_admin";

  // Super-admin needs the full org list — only fetched when applicable
  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    let cancelled = false;
    setLoadingSA(true);
    (async () => {
      const { data: orgs } = await supabase
        .from("organizations")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (cancelled) return;
      const orgList = fromDb<Organization[]>(orgs ?? []);
      setSuperAdminOrgs(orgList);
      const stored = localStorage.getItem("sa_active_org");
      const activeId = stored && orgList.find(o => o.id === stored)
        ? stored
        : orgList[0]?.id ?? null;
      setSuperAdminActiveId(activeId);
      setLoadingSA(false);
    })();
    return () => { cancelled = true; };
  }, [user, isSuperAdmin]);

  const setActiveOrganization = useCallback((id: string) => {
    if (isSuperAdmin) {
      setSuperAdminActiveId(id);
      localStorage.setItem("sa_active_org", id);
    }
  }, [isSuperAdmin]);

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

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

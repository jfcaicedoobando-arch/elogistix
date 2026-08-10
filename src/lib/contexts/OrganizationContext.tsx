import { createContext, useContext, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { syncSentryActiveOrg } from "@/lib/observability/sentry/user";
import { useSuperAdminOrgs } from "@/lib/contexts/organization/useSuperAdminOrgs";
import type { Organization } from "@/lib/contexts/organization/types";

export type { Organization };

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
  /** RG7: falló la carga del listado de organizaciones del super admin. */
  errorOrganizaciones: boolean;
  /** RG7: reintenta la carga tras un error (botón en SeleccionaOrganizacion). */
  reintentarCargaOrganizaciones: () => void;
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
  errorOrganizaciones: false,
  reintentarCargaOrganizaciones: () => {},
});


export const useOrganization = () => useContext(OrganizationContext);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, role, organizationId: cachedOrgId, organization: cachedOrg, loading: authLoading } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const sa = useSuperAdminOrgs(Boolean(user) && isSuperAdmin);

  const setActiveOrganization = useCallback((id: string) => {
    if (!isSuperAdmin) return;
    sa.cambiarTenant(id);
  }, [isSuperAdmin, sa]);

  const clearActiveOrganization = useCallback(() => {
    if (!isSuperAdmin) return;
    sa.cambiarTenant(null);
  }, [isSuperAdmin, sa]);

  const value = useMemo<OrganizationContextType>(() => {
    if (isSuperAdmin) {
      const active = sa.organizations.find(o => o.id === sa.activeId) ?? null;
      return {
        organizationId: sa.activeId,
        organization: active,
        organizations: sa.organizations,
        setActiveOrganization,
        clearActiveOrganization,
        isSuperAdmin: true,
        requiereSeleccionOrg: !sa.activeId,
        loading: authLoading || sa.loading,
        errorOrganizaciones: sa.errorOrganizaciones,
        reintentarCargaOrganizaciones: sa.reintentarCargaOrganizaciones,
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
      clearActiveOrganization,
      isSuperAdmin: false,
      requiereSeleccionOrg: false,
      loading: authLoading,
      errorOrganizaciones: false,
      reintentarCargaOrganizaciones: () => {},
    };
  }, [isSuperAdmin, sa, cachedOrgId, cachedOrg, authLoading, setActiveOrganization, clearActiveOrganization]);


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

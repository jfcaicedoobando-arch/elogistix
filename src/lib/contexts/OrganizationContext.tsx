import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { listActiveOrganizations, setSuperAdminOrg } from "@/features/admin/services/organization";
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
      // El super admin es administrador de la plataforma, NO miembro de un
      // tenant: nunca se le auto-asigna una organización. Sólo se restaura la
      // preferencia que él eligió explícitamente (y que sigue activa).
      const activeId = stored && orgList.find(o => o.id === stored) ? stored : null;
      setSuperAdminActiveId(activeId);
      // Re-sincroniza el servidor con la preferencia local (otro navegador o
      // sesión pudo dejar seleccionado un tenant distinto). Se espera el
      // round-trip ANTES de liberar `loading`: así ninguna query de agregación
      // se dispara con el tenant equivocado.
      await setSuperAdminOrg(activeId).catch(() => undefined);
      if (cancelled) return;
      setLoadingSA(false);
    })();
    return () => { cancelled = true; };
  }, [user, isSuperAdmin]);

  const setActiveOrganization = useCallback((id: string) => {
    if (!isSuperAdmin) return;
    setSuperAdminActiveId(id);
    safeLocalStorage.setItem(STORAGE_KEYS.superAdminActiveOrg, id);
    // El tenant activo se persiste en el servidor: las RPC de agregación
    // (`dashboard_summary`, `operaciones_stats`, ...) resuelven la organización
    // con `org_scope()`. Sin este guardado el super admin vería los datos de
    // todas las organizaciones mezclados. Se limpia la caché ya persistida
    // *antes* del round-trip y se vuelve a limpiar después para que ninguna
    // query en vuelo guarde datos del tenant anterior.
    queryClient.clear();
    void setSuperAdminOrg(id)
      .catch(() => undefined)
      .finally(() => queryClient.clear());
  }, [isSuperAdmin, queryClient]);

  const clearActiveOrganization = useCallback(() => {
    if (!isSuperAdmin) return;
    setSuperAdminActiveId(null);
    safeLocalStorage.removeItem(STORAGE_KEYS.superAdminActiveOrg);
    queryClient.clear();
    void setSuperAdminOrg(null)
      .catch(() => undefined)
      .finally(() => queryClient.clear());
  }, [isSuperAdmin, queryClient]);

  const value = useMemo<OrganizationContextType>(() => {
    if (isSuperAdmin) {
      const active = superAdminOrgs.find(o => o.id === superAdminActiveId) ?? null;
      return {
        organizationId: superAdminActiveId,
        organization: active,
        organizations: superAdminOrgs,
        setActiveOrganization,
        clearActiveOrganization,
        isSuperAdmin: true,
        requiereSeleccionOrg: !superAdminActiveId,
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
      clearActiveOrganization,
      isSuperAdmin: false,
      requiereSeleccionOrg: false,
      loading: authLoading,
    };
  }, [isSuperAdmin, superAdminOrgs, superAdminActiveId, cachedOrgId, cachedOrg, authLoading, loadingSA, setActiveOrganization, clearActiveOrganization]);


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

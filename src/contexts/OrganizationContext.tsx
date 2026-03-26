import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, role } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = (role as string) === "super_admin";

  const fetchMembership = useCallback(async () => {
    if (!user) {
      setOrganizationId(null);
      setOrganization(null);
      setOrganizations([]);
      setLoading(false);
      return;
    }

    try {
      if (isSuperAdmin) {
        // Super admin can see all organizations
        const { data: orgs } = await supabase
          .from("organizations")
          .select("*")
          .eq("activo", true)
          .order("nombre");
        
        const orgList = (orgs ?? []) as unknown as Organization[];
        setOrganizations(orgList);
        
        // Default to first org or stored preference
        const stored = localStorage.getItem("sa_active_org");
        const activeId = stored && orgList.find(o => o.id === stored)
          ? stored
          : orgList[0]?.id ?? null;
        
        setOrganizationId(activeId);
        setOrganization(orgList.find(o => o.id === activeId) ?? null);
      } else {
        // Regular user — get their org membership
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (membership) {
          const { data: org } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", membership.organization_id)
            .single();
          
          const orgData = org as unknown as Organization | null;
          setOrganizationId(membership.organization_id);
          setOrganization(orgData);
          setOrganizations(orgData ? [orgData] : []);
        }
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin]);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  const setActiveOrganization = useCallback((id: string) => {
    setOrganizationId(id);
    setOrganization(organizations.find(o => o.id === id) ?? null);
    if (isSuperAdmin) {
      localStorage.setItem("sa_active_org", id);
    }
  }, [organizations, isSuperAdmin]);

  return (
    <OrganizationContext.Provider
      value={{ organizationId, organization, organizations, setActiveOrganization, isSuperAdmin, loading }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

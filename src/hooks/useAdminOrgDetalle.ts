/**
 * Composición de hooks especializados para el detalle de organización (super admin).
 * Mantiene la API pública previa para evitar refactor en componentes consumidores.
 */
import { useState } from "react";
import { usePlanes } from "@/hooks/usePlanes";
import { useAdminOrgInfo } from "@/hooks/admin/useAdminOrgInfo";
import { useAdminOrgKpis } from "@/hooks/admin/useAdminOrgKpis";
import { useAdminOrgMembers, type MemberRow } from "@/hooks/admin/useAdminOrgMembers";
import { useAdminOrgConfig } from "@/hooks/admin/useAdminOrgConfig";

export type { MemberRow };

export function useAdminOrgDetalle(id: string | undefined) {
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const { data: planes = [] } = usePlanes();
  const info = useAdminOrgInfo(id);
  const kpis = useAdminOrgKpis(id);
  const membersHook = useAdminOrgMembers(id);
  const config = useAdminOrgConfig(id);

  return {
    ...info,
    planes,
    addMemberOpen, setAddMemberOpen,
    ...kpis,
    ...membersHook,
    ...config,
  };
}

/**
 * Composición de hooks especializados para el detalle de organización (super admin).
 * Mantiene la API pública previa para evitar refactor en componentes consumidores.
 */
import { useState } from "react";
import { usePlanes } from "@/features/admin/hooks/usePlanes";
import { useAdminOrgInfo } from "@/features/admin/hooks/useAdminOrgInfo";
import { useAdminOrgKpis } from "@/features/admin/hooks/useAdminOrgKpis";
import { useAdminOrgMembers, type MemberRow } from "@/features/admin/hooks/useAdminOrgMembers";
import { useAdminOrgConfig } from "@/features/admin/hooks/useAdminOrgConfig";

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

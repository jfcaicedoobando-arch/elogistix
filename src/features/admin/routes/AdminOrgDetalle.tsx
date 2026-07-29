import { useParams } from "react-router-dom";
import { Users, Ship, UserCheck, ClipboardList } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import CrearMiembroOrgDialog from "@/features/admin/components/CrearMiembroOrgDialog";
import { OrgHeader } from "@/features/admin/components/orgDetalle/OrgHeader";
import { OrgInfoCard } from "@/features/admin/components/orgDetalle/OrgInfoCard";
import { OrgMembersCard } from "@/features/admin/components/orgDetalle/OrgMembersCard";
import { OrgConfigCard } from "@/features/admin/components/orgDetalle/OrgConfigCard";
import { useAdminOrgDetalle } from "@/features/admin/hooks";
import { PageContainer } from "@/components/shared/PageContainer";

import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useDocumentTitle } from "@/hooks/shared";

export default function AdminOrgDetalle() {
  const { id } = useParams<{ id: string }>();

  const {
    org, planes,
    editing, setEditing,
    editNombre, setEditNombre,
    editRfc, setEditRfc,
    editPlan, setEditPlan,
    addMemberOpen, setAddMemberOpen,
    updateOrg, toggleActivo,
    memberCount, embarqueCount, clienteCount, cotizacionCount,
    members, loadingMembers,
    configItems, loadingConfig, grouped,
    updateRole, removeMember,
    cancelEditing, saveEditing, invalidateMembers,
  } = useAdminOrgDetalle(id);
  useRegisterBreadcrumbLabel(id, org?.nombre);
  useDocumentTitle(org ? `Organización · ${org.nombre}` : "Organización");

  if (!org) return null;
  const isActive = org.activo !== false;

  return (
    <PageContainer>
      <OrgHeader
        nombre={org.nombre}
        rfc={org.rfc}
        plan={org.plan}
        activo={isActive}
        toggleActivoPending={toggleActivo.isPending}
        onToggleActivo={(next) => toggleActivo.mutate(next)}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Miembros" value={memberCount} icon={Users} variant="info" iconVariant="chip" />
        <KpiCard label="Embarques" value={embarqueCount} icon={Ship} variant="accent" iconVariant="chip" />
        <KpiCard label="Clientes" value={clienteCount} icon={UserCheck} variant="success" iconVariant="chip" />
        <KpiCard label="Cotizaciones" value={cotizacionCount} icon={ClipboardList} variant="destructive" iconVariant="chip" />
      </div>

      <OrgInfoCard
        org={org}
        planes={planes}
        editing={editing} setEditing={setEditing}
        editNombre={editNombre} setEditNombre={setEditNombre}
        editRfc={editRfc} setEditRfc={setEditRfc}
        editPlan={editPlan} setEditPlan={setEditPlan}
        savePending={updateOrg.isPending}
        onSave={saveEditing}
        onCancel={cancelEditing}
      />

      <OrgMembersCard
        members={members}
        loading={loadingMembers}
        onAddClick={() => setAddMemberOpen(true)}
        onChangeRole={(memberId, role) => updateRole.mutate({ memberId, role })}
        onRemove={(memberId) => removeMember.mutate(memberId)}
      />

      <OrgConfigCard
        loading={loadingConfig}
        totalItems={configItems.length}
        grouped={grouped}
      />

      {id && (
        <CrearMiembroOrgDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          organizationId={id}
          onCreated={invalidateMembers}
        />
      )}
    </PageContainer>
  );
}

import { useParams } from "react-router-dom";
import { Users, Ship, UserCheck, FileText } from "lucide-react";
import { KpiCard } from "@/features/operaciones/components/KpiCard";
import CrearMiembroOrgDialog from "@/features/admin/components/CrearMiembroOrgDialog";
import { OrgHeader } from "@/features/admin/components/orgDetalle/OrgHeader";
import { OrgInfoCard } from "@/features/admin/components/orgDetalle/OrgInfoCard";
import { OrgMembersCard } from "@/features/admin/components/orgDetalle/OrgMembersCard";
import { OrgConfigCard } from "@/features/admin/components/orgDetalle/OrgConfigCard";
import { useAdminOrgDetalle } from "@/features/admin/hooks";

import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";

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

  if (!org) return null;
  const isActive = org.activo !== false;

  return (
    <div className="space-y-4 sm:space-y-6">
      <OrgHeader
        nombre={org.nombre}
        rfc={org.rfc}
        plan={org.plan}
        activo={isActive}
        toggleActivoPending={toggleActivo.isPending}
        onToggleActivo={(next) => toggleActivo.mutate(next)}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard titulo="Miembros" valor={memberCount} icono={Users} color="blue" />
        <KpiCard titulo="Embarques" valor={embarqueCount} icono={Ship} color="violet" />
        <KpiCard titulo="Clientes" valor={clienteCount} icono={UserCheck} color="emerald" />
        <KpiCard titulo="Cotizaciones" valor={cotizacionCount} icono={FileText} color="red" />
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
        <AgregarMiembroOrgDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          organizationId={id}
          existingUserIds={members.map((m) => m.user_id)}
          onAdded={invalidateMembers}
        />
      )}
    </div>
  );
}

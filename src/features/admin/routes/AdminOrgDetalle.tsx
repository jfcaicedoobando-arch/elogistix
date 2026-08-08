import { useParams } from "react-router-dom";
import { useState } from "react";
import { Users, Ship, UserCheck, ClipboardList } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import CrearMiembroOrgDialog from "@/features/admin/components/CrearMiembroOrgDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
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
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    org, planes,
    editing, setEditing,
    editNombre, setEditNombre,
    editRfc, setEditRfc,
    editPlan, setEditPlan,
    addMemberOpen, setAddMemberOpen,
    updateOrg, toggleActivo, deleteOrg,
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
        deletePending={deleteOrg.isPending}
        onToggleActivo={(next) => toggleActivo.mutate(next)}
        onDelete={() => setDeleteOpen(true)}
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
        <>
          <CrearMiembroOrgDialog
            open={addMemberOpen}
            onOpenChange={setAddMemberOpen}
            organizationId={id}
            onCreated={invalidateMembers}
          />
          <DoubleConfirmDeleteDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            entityName="organización"
            description={`¿Eliminar la organización "${org.nombre}"? Solo se pueden eliminar organizaciones completamente vacías (sin embarques, clientes, proveedores, facturas ni pagos). Si tiene datos, deberás desactivarla en su lugar.`}
            finalDescription="Esta acción borra la organización, su configuración y sus miembros. No se puede deshacer."
            onConfirm={() => deleteOrg.mutate()}
            isPending={deleteOrg.isPending}
          />
        </>
      )}
    </PageContainer>
  );
}

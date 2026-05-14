import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import NuevoUsuarioDialog from "@/components/usuario/NuevoUsuarioDialog";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAdminUsuariosController } from "@/hooks/admin/useAdminUsuariosController";
import { AdminUsuariosFilters } from "@/components/admin/AdminUsuariosFilters";
import { buildAdminUsuariosColumns } from "@/components/admin/adminUsuariosColumns";

export default function AdminUsuarios() {
  const { state, setters, data, actions } = useAdminUsuariosController();
  const columns = useMemo(
    () => buildAdminUsuariosColumns(setters.setDeleteTarget),
    [setters.setDeleteTarget],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users className="h-6 w-6 text-primary" />}
        title="Usuarios Globales"
        description={`${data.filtered.length} de ${data.users.length} usuarios en todas las organizaciones.`}
        actions={
          <Button onClick={() => setters.setDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Nuevo Usuario
          </Button>
        }
      />

      <NuevoUsuarioDialog
        open={state.dialogOpen}
        onOpenChange={setters.setDialogOpen}
        onCreated={() => actions.refetch()}
        showOrgSelector
      />

      <DoubleConfirmDeleteDialog
        open={!!state.deleteTarget}
        onOpenChange={(v) => { if (!v) setters.setDeleteTarget(null); }}
        entityName={state.deleteTarget?.email ?? "usuario"}
        description={`El usuario ${state.deleteTarget?.email} será eliminado permanentemente del sistema, incluyendo sus membresías y roles.`}
        finalDescription="Esta acción eliminará la cuenta de autenticación, roles y membresías de organización. No se puede deshacer."
        onConfirm={actions.handleDelete}
        isPending={actions.deleteUserPending}
      />

      <AdminUsuariosFilters
        search={state.search}
        onSearchChange={setters.setSearch}
        orgFilter={state.orgFilter}
        onOrgChange={setters.setOrgFilter}
        roleFilter={state.roleFilter}
        onRoleChange={setters.setRoleFilter}
        orgs={data.orgs}
        roles={data.roles}
      />

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={data.filtered}
          isLoading={data.isLoading}
          emptyMessage="No se encontraron usuarios con los filtros aplicados."
          rowKey={(u) => u.user_id + u.org_nombre}
          density="comfortable"
        />
      </div>
    </div>
  );
}

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { useAdminOrganizacionesController } from "@/features/admin/hooks";
import { AdminOrganizacionesFilters } from "@/features/admin/components/AdminOrganizacionesFilters";
import { NuevaOrganizacionDialog } from "@/features/admin/components/NuevaOrganizacionDialog";
import { buildAdminOrganizacionesColumns } from "@/features/admin/components/AdminOrganizacionesColumns";
import { useDocumentTitle } from "@/hooks/shared";

export default function AdminOrganizaciones() {
  useDocumentTitle('Organizaciones');
  const { state, setters, data, createOrg } = useAdminOrganizacionesController();
  const columns = useMemo(() => buildAdminOrganizacionesColumns(), []);

  return (
    <PageContainer>
      <PageHeader
        icon={<Building2 className="h-6 w-6 text-primary" />}
        title="Organizaciones"
        description={`${data.filtered.length} de ${data.orgs.length} empresas en la plataforma.`}
        actions={
          <Button onClick={() => setters.setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva Organización
          </Button>
        }
      />

      <AdminOrganizacionesFilters
        search={state.search}
        onSearchChange={setters.setSearch}
        planFilter={state.planFilter}
        onPlanChange={setters.setPlanFilter}
        estadoFilter={state.estadoFilter}
        onEstadoChange={setters.setEstadoFilter}
        planes={data.planes}
      />

      <div className="rounded-md border">
        <DataTable
          columns={columns}
          data={data.filtered}
          isLoading={data.isLoading}
          emptyMessage="No se encontraron organizaciones con los filtros aplicados."
          rowKey={(o) => o.id}
          density="comfortable"
          getRowHref={(o) => `/admin/organizaciones/${o.id}`}
        />
      </div>

      <NuevaOrganizacionDialog
        open={state.dialogOpen}
        onOpenChange={setters.setDialogOpen}
        nombre={state.nombre}
        onNombreChange={setters.setNombre}
        rfc={state.rfc}
        onRfcChange={setters.setRfc}
        ownerUserId={state.ownerUserId}
        onOwnerUserIdChange={setters.setOwnerUserId}
        onCreate={createOrg.mutate}
        isPending={createOrg.isPending}
      />
    </PageContainer>
  );
}

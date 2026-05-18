import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, Plus } from "lucide-react";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAdminOrganizacionesController } from "@/hooks/admin";
import { AdminOrganizacionesFilters } from "@/components/admin/AdminOrganizacionesFilters";
import { NuevaOrganizacionDialog } from "@/components/admin/NuevaOrganizacionDialog";
import { buildAdminOrganizacionesColumns } from "@/components/admin/adminOrganizacionesColumns";

export default function AdminOrganizaciones() {
  const navigate = useNavigate();
  const { state, setters, data, createOrg } = useAdminOrganizacionesController();
  const columns = useMemo(() => buildAdminOrganizacionesColumns(navigate), [navigate]);

  return (
    <div className="space-y-6">
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
        />
      </div>

      <NuevaOrganizacionDialog
        open={state.dialogOpen}
        onOpenChange={setters.setDialogOpen}
        nombre={state.nombre}
        onNombreChange={setters.setNombre}
        rfc={state.rfc}
        onRfcChange={setters.setRfc}
        onCreate={createOrg.mutate}
        isPending={createOrg.isPending}
      />
    </div>
  );
}

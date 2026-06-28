import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/shared/SearchInput";
import { useClientesPaginados } from "@/features/cliente/hooks";
import { usePermissions } from "@/hooks/shared";
import NuevoClienteDialog from "@/features/cliente/components/NuevoClienteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useDebounce } from "@/hooks/shared";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { useListPageState } from "@/hooks/shared";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { BulkImportDialog } from "@/components/shared/BulkImportDialog";
import {
  CLIENTE_TEMPLATE_HEADERS,
  mapClienteRows,
} from "@/lib/csv/importSchemas";
import { useOrgFilter } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createCliente } from "@/features/cliente/services";
import { useToast } from "@/hooks/shared";
import { notifySuccess } from "@/components/shared/utils/appFeedback";
import { useRegistrarActividad } from "@/hooks/shared";
import {
  clientesColumns,
  type ClienteRow,
} from "@/features/cliente/components/clientesTableConfig";
import { ClienteMobileCard } from "@/features/cliente/components/ClienteMobileCard";

export default function Clientes() {
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { organizationId } = useOrgFilter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const registrarActividad = useRegistrarActividad();

  const { search, setSearch, page, setPage, pageSize, setPageSize } = useListPageState({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading } = useClientesPaginados({
    search: debouncedSearch,
    page,
    pageSize,
  });

  const clientes = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    // pb-24 md:pb-0 evita que el FAB tape la última fila de la lista en mobile.
    <div className="space-y-6 pb-24 md:pb-0">

      <PageHeader
        icon={<Users className="h-6 w-6 text-accent" />}
        title="Clientes"
        description={`${totalCount} clientes registrados`}
        actions={
          canEdit ? (
            <div className="hidden md:flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />Importar CSV
              </Button>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />Nuevo Cliente
              </Button>
            </div>
          ) : null
        }
      />

      <Card>
        <CardContent className="p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre o RFC..." className="max-w-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={clientesColumns}
            data={clientes as ClienteRow[]}
            isLoading={isLoading}
            emptyMessage={search ? "No se encontraron clientes" : "No hay clientes registrados"}
            onRowClick={(c) => navigate(`/clientes/${c.id}`)}
            rowKey={(c) => c.id}
            density="comfortable"
            mobileCard={(c) => <ClienteMobileCard c={c} />}
            pagination={{
              page,
              totalPages,
              onPageChange: setPage,
              pageSize,
              onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
            }}
          />
        </CardContent>
      </Card>

      <NuevoClienteDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar clientes desde CSV"
        description="Carga un archivo CSV con clientes. Sólo se insertarán las filas válidas."
        templateHeaders={CLIENTE_TEMPLATE_HEADERS}
        templateExampleRow={[
          "Acme S.A. de C.V.",
          "ACM010101AAA",
          "contacto@acme.mx",
          "55 1234 5678",
          "Juan Pérez",
          "Av. Reforma 123",
          "Ciudad de México",
          "CDMX",
          "06600",
          "30",
        ]}
        templateFileName="plantilla-clientes.csv"
        mapRows={(rows) => mapClienteRows(rows, organizationId)}
        onCommit={async (payloads) => {
          for (const p of payloads) {
            // Inserción secuencial para no exceder rate-limit y conservar
            // mensajes de error por fila si alguna RFC duplica.
            await createCliente(p);
          }
          registrarActividad.mutate({
            accion: "crear",
            modulo: "clientes",
            entidad_nombre: `Importación CSV (${payloads.length})`,
          });
        }}
        onSuccess={(n) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
          notifySuccess(toast, { title: `Importados ${n} clientes` });
        }}
      />

      {canEdit && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo cliente"
          onClick={() => setDialogOpen(true)}
        />
      )}
    </div>
  );
}


import { pluralizar } from "@/lib/format/pluralizar";
import { Building2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClientesPaginados } from "@/features/cliente/hooks";
import { usePermissions } from "@/hooks/shared";
import NuevoClienteDialog from "@/features/cliente/components/NuevoClienteDialog";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import { useDebounce } from "@/hooks/shared";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { BulkImportDialog } from "@/components/shared/BulkImportDialog";
import { CLIENTE_TEMPLATE_HEADERS, mapClienteRows } from "@/lib/csv/importSchemas";
import { useOrgFilter } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { createClientesLote } from "@/features/cliente/services";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { useRegistrarActividad } from "@/hooks/shared";
import {
  buildClientesColumns,
  type ClienteRow,
} from "@/features/cliente/components/clientesTableConfig";
import { ClienteMobileCard } from "@/features/cliente/components/ClienteMobileCard";
import EmptyState from "@/components/empty/EmptyState";
import { useState, useMemo } from "react";
import { useDocumentTitle } from "@/hooks/shared";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

export default function Clientes() {
  useDocumentTitle("Clientes");
  const { canEdit } = usePermissions();
  const { organizationId } = useOrgFilter();
  const queryClient = useQueryClient();
  const registrarActividad = useRegistrarActividad();

  const {
    search,
    setSearch,
    page,
    setPage,
    pageSize,
    setPageSize,
    activeChips,
    activeCount,
    resetAll,
  } = useTableFilters({ defaultFilters: {}, defaultPageSize: 50 });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading, isError, refetch } = useClientesPaginados({
    search: debouncedSearch,
    page,
    pageSize,
  });

  const clientes = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const columns = useMemo(
    () => buildClientesColumns(),
    [],
  );

  return (
    <PageContainer className="pb-24 md:pb-6">
      <PageHeader
        icon={<Building2 className="h-6 w-6 text-accent" />}
        title="Clientes"
        description={`${pluralizar(totalCount, "cliente")} ${totalCount === 1 ? "registrado" : "registrados"}`}
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

      <UnifiedFiltersBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(0); }}
        searchPlaceholder="Buscar por nombre o RFC…"
        chips={activeChips}
        activeCount={activeCount}
        onClearAll={resetAll}
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
      >
      <Card>
        <CardContent className="p-0">
          {isLoading && !clientes.length ? (
            <div className="p-4">
              <ListSkeleton rows={8} />
            </div>
          ) : (
            <ResponsiveDataTable
              columns={columns}
              data={clientes as ClienteRow[]}
              isLoading={isLoading}
              emptyMessage={search ? `Sin resultados para «${search}»` : "No hay clientes registrados"}
              emptyState={
                <EmptyState
                  icon={Building2}
                  title={search ? `Sin resultados para «${search}»` : "Aún no hay clientes"}
                  description={search ? "Ajusta la búsqueda o límpiala para ver todos los clientes." : "Crea tu primer cliente para empezar a cotizar y facturar."}
                  primaryAction={
                    search
                      ? { label: "Limpiar búsqueda", onClick: () => setSearch("") }
                      : canEdit
                        ? { label: "Crear cliente", onClick: () => setDialogOpen(true) }
                        : undefined
                  }
                />
              }
              getRowHref={(c) => `/clientes/${c.id}`}
              rowKey={(c) => c.id}
              density={TABLE_DENSITY.listado}
              mobileCard={(c) => <ClienteMobileCard c={c} />}
              pagination={{
                page,
                totalPages,
                onPageChange: setPage,
                pageSize,
                onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
                pageSizeOptions: [50, 100, 200, 500],
                pageSizeLabels: { 500: "500" },
                total: totalCount,
              }}
            />
          )}
        </CardContent>
      </Card>
      </CargaGuard>

      <NuevoClienteDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar clientes desde CSV"
        description="Carga un archivo CSV con clientes. Sólo se insertarán las filas válidas."
        templateHeaders={CLIENTE_TEMPLATE_HEADERS}
        templateExampleRow={[
          "Acme S.A. de C.V.", "ACM010101AAA", "contacto@acme.mx",
          "55 1234 5678", "Juan Pérez", "Av. Reforma 123",
          "Ciudad de México", "CDMX", "06600", "30",
        ]}
        templateFileName="plantilla-clientes.csv"
        mapRows={(rows) => mapClienteRows(rows, organizationId)}
        onCommit={async (payloads, reportarProgreso) => {
          // N-05 (QA r2): un INSERT por lote de 200 filas (no uno por fila).
          // L3: se reporta el avance por lote para informar cortes parciales.
          const { creados, omitidos } = await createClientesLote(payloads, reportarProgreso);
          registrarActividad.mutate({
            accion: "crear",
            modulo: "clientes",
            entidad_nombre: `Importación CSV (${creados.length})`,
          });
          return { creados: creados.length, omitidos };
        }}
        onSuccess={(n) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.clientes.all });
          notifySuccess(undefined, { title: `Importados ${n} clientes` });
        }}
      />

      {canEdit && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo cliente"
          onClick={() => setDialogOpen(true)}
        />
      )}
    </PageContainer>
  );
}

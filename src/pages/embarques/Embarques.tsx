import { Plus, Ship, Download, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PaginationControls from "@/components/shared/PaginationControls";
import { DataTable } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import EmbarquesFiltros from "@/components/embarque/EmbarquesFiltros";
import { useEmbarquesPageController } from "@/hooks/embarque/useEmbarquesPageController";

export default function Embarques() {
  const {
    state,
    clientes,
    operadoresUnicos,
    columns,
    isLoading,
    isEmptyState,
    canEdit,
    embarqueAEliminar,
    setEmbarqueAEliminar,
    embarqueADuplicar,
    setEmbarqueADuplicar,
    handleEliminar,
    exportarCsv,
    eliminarEmbarquePending,
    navigate,
    prefetchEmbarque,
  } = useEmbarquesPageController();

  const {
    search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma,
    fechaDesde, fechaHasta, page, pageSize,
    setSearch, setFilterModo, setFilterEstado, setFilterCliente, setFilterOperador, setFilterProforma,
    setFechaDesde, setFechaHasta, setPage, setPageSize,
    filtered, displayCount, totalPages,
  } = state;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Embarques"
        description={`${displayCount} embarques encontrados`}
        actions={
          <>
            {/* Desktop md+: botones inline tradicionales */}
            {!isEmptyState && (
              <Button variant="outline" onClick={exportarCsv} className="hidden md:inline-flex">
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
            )}
            {canEdit && !isEmptyState && (
              <Button onClick={() => navigate("/embarques/nuevo")} className="hidden md:inline-flex">
                <Plus className="h-4 w-4 mr-2" /> Nuevo Embarque
              </Button>
            )}
            {/* Mobile <md: solo overflow menu para acciones secundarias.
                La acción primaria "Nuevo Embarque" se renderiza como FAB al final del componente. */}
            {!isEmptyState && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Más acciones">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportarCsv}>
                    <Download className="h-4 w-4 mr-2" /> Exportar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {isEmptyState ? (
        <Card className="shadow-md">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <img
              src="/placeholder.svg"
              alt="Sin embarques"
              className="h-40 w-40 opacity-80 mb-6"
            />
            <div className="flex items-center gap-2 mb-2">
              <Ship className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Aún no tienes embarques</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Comienza registrando tu primer embarque para dar seguimiento a tus operaciones de importación, exportación y más.
            </p>
            {canEdit && (
              <Button size="lg" onClick={() => navigate("/embarques/nuevo")}>
                <Plus className="h-5 w-5 mr-2" /> Crear mi primer embarque
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <EmbarquesFiltros
                search={search}
                onSearchChange={setSearch}
                filterModo={filterModo}
                onFilterModoChange={setFilterModo}
                filterEstado={filterEstado}
                onFilterEstadoChange={setFilterEstado}
                filterCliente={filterCliente}
                onFilterClienteChange={setFilterCliente}
                filterOperador={filterOperador}
                onFilterOperadorChange={setFilterOperador}
                filterProforma={filterProforma}
                onFilterProformaChange={setFilterProforma}
                fechaDesde={fechaDesde}
                onFechaDesdeChange={setFechaDesde}
                fechaHasta={fechaHasta}
                onFechaHastaChange={setFechaHasta}
                clientes={clientes}
                operadores={operadoresUnicos}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                emptyMessage="No se encontraron embarques"
                onRowClick={(e) => navigate(`/embarques/${e.id}`)}
                onRowMouseEnter={(e) => prefetchEmbarque(e.id)}
                rowKey={(e) => e.id}
                rowClassName={() => "group"}
              />
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
              />
            </CardContent>
          </Card>
        </>
      )}

      <DoubleConfirmDeleteDialog
        open={!!embarqueAEliminar}
        onOpenChange={(open) => { if (!open) setEmbarqueAEliminar(null); }}
        entityName="embarque"
        description={`El embarque ${embarqueAEliminar?.expediente} será eliminado permanentemente.`}
        finalDescription={`Esta acción no se puede deshacer. Se eliminarán todos los datos, documentos y costos asociados al embarque ${embarqueAEliminar?.expediente}.`}
        onConfirm={handleEliminar}
        isPending={eliminarEmbarquePending}
      />
      {embarqueADuplicar && (
        <DialogDuplicarEmbarque
          embarque={embarqueADuplicar}
          open
          onOpenChange={(open) => { if (!open) setEmbarqueADuplicar(null); }}
        />
      )}

    </div>
  );
}

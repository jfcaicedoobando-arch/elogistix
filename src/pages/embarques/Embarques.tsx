import { Plus, Download, MoreVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import EmbarquesFiltros from "@/components/embarque/EmbarquesFiltros";
import { EmbarquesEmptyState } from "@/components/embarque/EmbarquesEmptyState";
import { EmbarquesSortIndicator } from "@/components/embarque/EmbarquesSortIndicator";
import { useEmbarquesPageController } from "@/hooks/embarque/useEmbarquesPageController";

export default function Embarques() {
  const {
    state, clientes, operadoresUnicos, columns, isLoading, isEmptyState, canEdit,
    embarqueAEliminar, setEmbarqueAEliminar, embarqueADuplicar, setEmbarqueADuplicar,
    handleEliminar, exportarCsv, exportandoCsv, eliminarEmbarquePending,
    navigate, prefetchEmbarque,
  } = useEmbarquesPageController();

  const {
    search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma,
    fechaDesde, fechaHasta, page, pageSize,
    sortKey, sortDir, handleSortChange,
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
            {!isEmptyState && (
              <Button variant="outline" onClick={exportarCsv} disabled={exportandoCsv} className="hidden md:inline-flex">
                <Download className="h-4 w-4 mr-2" /> {exportandoCsv ? "Exportando..." : "Exportar CSV"}
              </Button>
            )}
            {canEdit && !isEmptyState && (
              <Button onClick={() => navigate("/embarques/nuevo")} className="hidden md:inline-flex">
                <Plus className="h-4 w-4 mr-2" /> Nuevo Embarque
              </Button>
            )}
            {!isEmptyState && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Más acciones">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={exportarCsv} disabled={exportandoCsv}>
                    <Download className="h-4 w-4 mr-2" /> {exportandoCsv ? "Exportando..." : "Exportar CSV"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {isEmptyState ? (
        <EmbarquesEmptyState canEdit={canEdit} onCreate={() => navigate("/embarques/nuevo")} />
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
              <EmbarquesSortIndicator
                sortKey={sortKey}
                sortDir={sortDir}
                onClear={() => handleSortChange(null, "asc")}
              />
              <DataTable
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                emptyMessage="No se encontraron embarques"
                onRowClick={(e) => navigate(`/embarques/${e.id}`)}
                onRowMouseEnter={(e) => prefetchEmbarque(e.id)}
                rowKey={(e) => e.id}
                rowClassName={() => "group"}
                sortMode="server"
                controlledSort={{ key: sortKey, dir: sortDir }}
                onSortChange={handleSortChange}
                density="comfortable"
                pagination={{
                  page,
                  totalPages,
                  onPageChange: setPage,
                  pageSize,
                  onPageSizeChange: (s) => { setPageSize(s); setPage(0); },
                }}
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

      {canEdit && !isEmptyState && (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo embarque"
          onClick={() => navigate("/embarques/nuevo")}
        />
      )}
    </div>
  );
}

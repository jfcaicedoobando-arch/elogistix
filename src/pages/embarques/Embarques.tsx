import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";

import EmbarquesFiltros from "@/components/embarque/EmbarquesFiltros";
import { EmbarquesEmptyState } from "@/components/embarque/EmbarquesEmptyState";
import { EmbarquesSortIndicator } from "@/components/embarque/EmbarquesSortIndicator";
import { EmbarquesHeaderActions } from "@/components/embarque/EmbarquesHeaderActions";
import { useEmbarquesPageController } from "@/hooks/embarque";

function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  if (!estadoActivo) return cont;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}

export default function Embarques() {
  const {
    state, clientes, operadoresUnicos, columns, isLoading, isEmptyState, canEdit,
    exportarCsv, exportandoCsv,
    navigate, prefetchEmbarque,
  } = useEmbarquesPageController();


  const {
    search, filterModo, filterEstado, filterCliente, filterOperador,
    fechaDesde, fechaHasta, page, pageSize,
    sortKey, sortDir, handleSortChange,
    setSearch, setFilterModo, setFilterEstado, setFilterCliente, setFilterOperador,
    setFechaDesde, setFechaHasta, setPage, setPageSize,
    filtered, expedientesCount, contenedoresCount, totalPages,
  } = state;


  const goNuevo = () => navigate("/embarques/nuevo");
  const headerDescription = buildDescription(contenedoresCount, expedientesCount, filterEstado !== "todos");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Embarques"
        description={headerDescription}
        actions={
          isEmptyState ? null : (
            <EmbarquesHeaderActions
              canEdit={canEdit}
              exportandoCsv={exportandoCsv}
              onExport={exportarCsv}
              onNuevo={goNuevo}
            />
          )
        }
      />

      {isEmptyState ? (
        <EmbarquesEmptyState canEdit={canEdit} onCreate={goNuevo} />
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

      {canEdit && !isEmptyState ? (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo embarque"
          onClick={goNuevo}
        />
      ) : null}
    </div>
  );
}

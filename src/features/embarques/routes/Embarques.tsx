"use memo";
import { useDeferredValue } from "react";
import { useDocumentTitle } from "@/hooks/shared";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { CargaGuard } from "@/components/shared/states/CargaGuard";

import EmbarquesFiltros from "@/features/embarques/components/EmbarquesFiltros";
import { EmbarquesAlertasPanel } from "@/features/embarques/components/EmbarquesAlertasPanel";
import { EmbarquesEmptyState } from "@/features/embarques/components/EmbarquesEmptyState";
import { EmbarquesSortIndicator } from "@/features/embarques/components/EmbarquesSortIndicator";
import { EmbarquesHeaderActions } from "@/features/embarques/components/EmbarquesHeaderActions";
import { useEmbarquesPageController, calcularEstadoEmbarque } from "@/features/embarques/hooks";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { formatDate, getOrigen, getDestino, shortName, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

function buildDescription(contenedoresCount: number, expedientesCount: number, estadoActivo: boolean): string {
  const cont = `${contenedoresCount} ${contenedoresCount === 1 ? "contenedor" : "contenedores"}`;
  if (!estadoActivo) return cont;
  const exp = `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
  return `${cont} en ${exp}`;
}

export default function Embarques() {
  useDocumentTitle("Embarques");
  const {
    state, clientes, operadoresUnicos, columns, isLoading, isError, refetch, isEmptyState,
    exportarCsv, exportandoCsv,
    navigate, prefetchEmbarque,
  } = useEmbarquesPageController();
  // v13.303.26 — el CTA "Nuevo embarque" desaparece: los embarques sólo se crean
  // desde una cotización Aceptada (política tarifa-first, sin excepciones).
  const canCrear = false;



  const {
    search, filterModo, filterEstado, filterCliente, filterOperador, filterAlerta,
    fechaDesde, fechaHasta, page, pageSize,
    sortKey, sortDir, handleSortChange,
    setSearch, setFilterModo, setFilterEstado, setFilterCliente, setFilterOperador, setFilterAlerta,
    setFechaDesde, setFechaHasta, setPage, setPageSize,
    filtered, expedientesCount, contenedoresCount, totalPages, totalCount, alertasResumen,
  } = state;


  const goNuevo = () => navigate("/embarques/nuevo");
  const headerDescription = buildDescription(contenedoresCount, expedientesCount, filterEstado !== "todos");

  // Diferimos las filas visibles del listado para que al cambiar filtros/página
  // el re-render pesado de la tabla no bloquee inputs ni interacciones (React 18).
  const deferredFiltered = useDeferredValue(filtered);

  return (
    // pb-24 md:pb-0: evita que el FAB tape la última fila en mobile.
    <PageContainer className="pb-24 md:pb-0">


      <PageHeader
        title="Embarques"
        description={headerDescription}
        actions={
          isEmptyState ? null : (
            <EmbarquesHeaderActions
              canEdit={canCrear}
              exportandoCsv={exportandoCsv}
              onExport={exportarCsv}
              onNuevo={goNuevo}
            />
          )
        }
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        errorTitle="No pudimos cargar los embarques"
        errorDescription="Revisa tu conexión e intenta de nuevo."
      >
        {isEmptyState ? (
          <EmbarquesEmptyState canEdit={canCrear} onCreate={goNuevo} />
        ) : (
          <>
          {alertasResumen ? (
            <EmbarquesAlertasPanel
              resumen={alertasResumen}
              activeAlerta={filterAlerta}
              onSelect={(a) => { setFilterAlerta(a); setPage(0); }}
            />
          ) : null}
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
              <ResponsiveDataTable
                columns={columns}
                data={deferredFiltered}
                isLoading={isLoading}
                emptyMessage="No se encontraron embarques"
                getRowHref={(e) => `/embarques/${e.id}`}
                onRowMouseEnter={(e) => prefetchEmbarque(e.id)}
                rowKey={(e) => e.id}
                rowClassName={() => "group"}
                sortMode="server"
                controlledSort={{ key: sortKey, dir: sortDir }}
                onSortChange={handleSortChange}
                density={TABLE_DENSITY.listado}
                className="pb-24 sm:pb-0"
                mobileCard={(e) => {
                  const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado, e.fecha_llegada_real);
                  return (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                          <ModoIcon modo={e.modo} size={14} />
                          <span className="truncate">{e.expediente}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {toTitleCase(e.cliente_nombre)}
                        </div>
                        <div className="text-label text-muted-foreground truncate mt-0.5">
                          {shortName(getOrigen(e))} → {shortName(getDestino(e))}
                          {e.eta ? ` · ETA ${formatDate(e.eta)}` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-2xs whitespace-nowrap ${getEstadoColor(estado)}`}>{estado}</Badge>
                    </div>
                  );
                }}
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
            </CardContent>
          </Card>
          </>
        )}
      </CargaGuard>

      {canCrear && !isEmptyState ? (
        <FloatingActionButton
          icon={<Plus className="h-6 w-6" />}
          label="Nuevo embarque"
          onClick={goNuevo}
        />
      ) : null}
    </PageContainer>
  );
}

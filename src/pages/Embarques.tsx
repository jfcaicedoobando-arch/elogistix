import { useState, useMemo } from "react";
import { Plus, Ship, Download } from "lucide-react";
import { exportToCsv } from "@/generators/exportCsv";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEliminarEmbarque, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { usePrefetchEmbarque } from "@/hooks/useEmbarqueQueries";
import { useOperadoresDistintos } from "@/hooks/useOperadoresDistintos";
import { getErrorMessage } from "@/lib/errorUtils";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { getOrigen, getDestino } from "@/lib/formatters";
import PaginationControls from "@/components/PaginationControls";
import { DataTable } from "@/components/DataTable";
import type { EmbarqueRow } from "@/hooks/useEmbarques";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import { useEmbarquesListExtras } from "@/hooks/useEmbarquesListData";
import EmbarquesFiltros from "@/components/embarque/EmbarquesFiltros";
import { useEmbarquesPageState } from "@/hooks/useEmbarquesPageState";
import { buildEmbarqueColumns } from "@/components/embarque/embarqueColumns";

export default function Embarques() {
  const navigate = useNavigate();
  const { data: clientes = [] } = useClientesForSelect();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();
  const prefetchEmbarque = usePrefetchEmbarque();

  const state = useEmbarquesPageState();
  const {
    search, filterModo, filterEstado, filterCliente, filterOperador,
    fechaDesde, fechaHasta, page, pageSize,
    setSearch, setFilterModo, setFilterEstado, setFilterCliente, setFilterOperador,
    setFechaDesde, setFechaHasta, setPage, setPageSize,
    embarques, filtered, displayCount, totalPages, isLoading, isEmptyState,
  } = state;

  const [embarqueAEliminar, setEmbarqueAEliminar] = useState<EmbarqueRow | null>(null);
  const [embarqueADuplicar, setEmbarqueADuplicar] = useState<EmbarqueRow | null>(null);

  const { data: operadoresUnicos = [] } = useOperadoresDistintos();

  const embarqueIds = useMemo(() => embarques.map(e => e.id), [embarques]);
  const { data: extrasData } = useEmbarquesListExtras(embarqueIds);
  const liquidacionMap = extrasData?.liquidacion ?? {};
  const docsMap = extrasData?.docs ?? {};

  const handleEliminar = async () => {
    if (!embarqueAEliminar) return;
    const { id, expediente, cliente_nombre, modo } = embarqueAEliminar;
    try {
      await eliminarEmbarque.mutateAsync(id);
      registrarActividad.mutate({
        accion: 'eliminar', modulo: 'embarques',
        entidad_id: id, entidad_nombre: expediente,
        detalles: { cliente: cliente_nombre, modo },
      });
      toast({ title: "Embarque eliminado", description: `${expediente} fue eliminado permanentemente.` });
    } catch (err: unknown) {
      toast({ title: "Error al eliminar", description: getErrorMessage(err), variant: "destructive" });
    }
    setEmbarqueAEliminar(null);
  };

  const columns = useMemo(
    () => buildEmbarqueColumns({
      canEdit,
      docsMap,
      liquidacionMap,
      onEditar: (e) => navigate(`/embarques/${e.id}/editar`),
      onDuplicar: setEmbarqueADuplicar,
      onEliminar: setEmbarqueAEliminar,
    }),
    [canEdit, liquidacionMap, docsMap, navigate],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Embarques</h1>
          <p className="text-sm text-muted-foreground">{displayCount} embarques encontrados</p>
        </div>
        <div className="flex gap-2">
          {!isEmptyState && (
            <Button variant="outline" onClick={() => exportToCsv(
              `embarques_${new Date().toISOString().slice(0, 10)}.csv`,
              [
                { key: "expediente", label: "Expediente" },
                { key: "bl_master", label: "BL Master" },
                { key: "cliente_nombre", label: "Cliente" },
                { key: "modo", label: "Modo" },
                { key: "tipo", label: "Tipo Operación" },
                { key: "origen", label: "Origen" },
                { key: "destino", label: "Destino" },
                { key: "estado", label: "Estado" },
                { key: "etd", label: "ETD" },
                { key: "eta", label: "ETA" },
                { key: "operador", label: "Operador" },
                { key: "contenedor", label: "Contenedor" },
                { key: "tipo_contenedor", label: "Tipo Contenedor" },
                { key: "descripcion_mercancia", label: "Descripción Mercancía" },
                { key: "tipo_cambio_usd", label: "T/C USD" },
                { key: "tipo_cambio_eur", label: "T/C EUR" },
                { key: "liquidacion", label: "Estado Costos" },
                { key: "created_at", label: "Fecha Creación" },
              ],
              filtered.map(e => {
                const liq = liquidacionMap[e.id];
                const estadoLiq = !liq || liq.total === 0 ? "—" : liq.pagados === liq.total ? "Pagado" : liq.pagados > 0 ? "Parcial" : "Pendiente";
                return {
                  expediente: e.expediente,
                  bl_master: e.bl_master || "",
                  cliente_nombre: e.cliente_nombre,
                  modo: e.modo,
                  tipo: e.tipo,
                  origen: getOrigen(e),
                  destino: getDestino(e),
                  estado: calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
                  etd: e.etd || "",
                  eta: e.eta || "",
                  operador: e.operador || "",
                  contenedor: e.contenedor || "",
                  tipo_contenedor: e.tipo_contenedor || "",
                  descripcion_mercancia: e.descripcion_mercancia || "",
                  tipo_cambio_usd: e.tipo_cambio_usd ?? "",
                  tipo_cambio_eur: e.tipo_cambio_eur ?? "",
                  liquidacion: estadoLiq,
                  created_at: e.created_at ? new Date(e.created_at).toLocaleDateString("es-MX") : "",
                };
              }),
            )}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          )}
          {canEdit && !isEmptyState && (
            <Button onClick={() => navigate("/embarques/nuevo")}>
              <Plus className="h-4 w-4 mr-2" /> Nuevo Embarque
            </Button>
          )}
        </div>
      </div>

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
        isPending={eliminarEmbarque.isPending}
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

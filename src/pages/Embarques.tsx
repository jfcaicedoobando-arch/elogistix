import { useState, useMemo } from "react";
import { Plus, Trash2, MoreHorizontal, Pencil, Copy, Ship, Download, AlertTriangle, CircleDollarSign } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useEmbarquesPaginados, calcularEstadoEmbarque, useEliminarEmbarque } from "@/hooks/useEmbarques";
import { useOperadoresDistintos } from "@/hooks/useOperadoresDistintos";
import { getErrorMessage } from "@/lib/errorUtils";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import { ESTADOS_EMBARQUE, MODOS_TRANSPORTE } from "@/data/embarqueConstants";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import type { EmbarqueRow } from "@/hooks/useEmbarqueUtils";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DEFAULT_PAGE_SIZE = 20;

function shortName(raw: string) {
  return raw.split(/[,—]/)[0].trim();
}

export default function Embarques() {
  const navigate = useNavigate();
  const { data: clientes = [] } = useClientesForSelect();
  const [search, setSearch] = useState("");
  const [filterModo, setFilterModo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [filterOperador, setFilterOperador] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();

  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading } = useEmbarquesPaginados({
    search: debouncedSearch,
    filterModo,
    filterEstado,
    filterCliente,
    filterOperador,
    page,
    pageSize,
    fechaDesde,
    fechaHasta,
  });

  const embarques = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;

  const filtered = useMemo(() => {
    if (filterEstado === "todos") return embarques;
    return embarques.filter((e) => {
      const estadoCalculado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      return estadoCalculado === filterEstado;
    });
  }, [embarques, filterEstado]);

  const displayCount = filterEstado !== "todos" ? filtered.length : totalCount;
  const totalPages = filterEstado !== "todos" ? 1 : Math.ceil(totalCount / pageSize);

  const [embarqueAEliminar, setEmbarqueAEliminar] = useState<EmbarqueRow | null>(null);
  const [embarqueADuplicar, setEmbarqueADuplicar] = useState<EmbarqueRow | null>(null);

  const { data: operadoresUnicos = [] } = useOperadoresDistintos();

  // Liquidation status per embarque
  const embarqueIds = useMemo(() => embarques.map(e => e.id), [embarques]);
  const { data: liquidacionMap = {} } = useQuery({
    queryKey: ['embarques-liquidacion', embarqueIds],
    queryFn: async () => {
      if (embarqueIds.length === 0) return {};
      const { data, error } = await supabase
        .from('conceptos_costo')
        .select('embarque_id, estado_liquidacion')
        .in('embarque_id', embarqueIds);
      if (error) throw error;
      const map: Record<string, { total: number; pagados: number }> = {};
      (data ?? []).forEach((c) => {
        if (!map[c.embarque_id]) map[c.embarque_id] = { total: 0, pagados: 0 };
        map[c.embarque_id].total++;
        if (c.estado_liquidacion === 'Pagado') map[c.embarque_id].pagados++;
      });
      return map;
    },
    enabled: embarqueIds.length > 0,
  });

  // Documentos incompletos per embarque
  const { data: docsMap = {} } = useQuery({
    queryKey: ['embarques-docs-status', embarqueIds],
    queryFn: async () => {
      if (embarqueIds.length === 0) return {};
      const { data, error } = await supabase
        .from('documentos_embarque')
        .select('embarque_id, estado')
        .in('embarque_id', embarqueIds);
      if (error) throw error;
      const map: Record<string, { total: number; pendientes: number }> = {};
      (data ?? []).forEach((d) => {
        if (!map[d.embarque_id]) map[d.embarque_id] = { total: 0, pendientes: 0 };
        map[d.embarque_id].total++;
        if (d.estado !== 'Recibido' && d.estado !== 'Validado') map[d.embarque_id].pendientes++;
      });
      return map;
    },
    enabled: embarqueIds.length > 0,
  });

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

  const getLiquidacionBadge = (embarqueId: string) => {
    const info = liquidacionMap[embarqueId];
    if (!info || info.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
    if (info.pagados === info.total) return <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-300">Pagado</Badge>;
    if (info.pagados > 0) return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-300">Parcial</Badge>;
    return <Badge variant="secondary" className="text-xs bg-red-100 text-red-700 border-red-300">Pendiente</Badge>;
  };

  const columns: DataTableColumn<EmbarqueRow>[] = useMemo(() => {
    const base: DataTableColumn<EmbarqueRow>[] = [
      {
        key: "expediente", header: "Expediente", width: "w-[130px]", className: "font-medium", sticky: true, sortable: true, sortValue: (e) => e.expediente,
        render: (e) => {
          const docInfo = docsMap[e.id];
          const hayPendientes = docInfo && docInfo.pendientes > 0;
          return (
            <span className="flex items-center gap-1">
              {e.expediente}
              {hayPendientes && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{docInfo.pendientes} doc(s) pendientes</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          );
        },
      },
      { key: "bl", header: "BL Master", width: "w-[120px]", className: "text-xs", render: (e) => e.bl_master || "-" },
      { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => e.cliente_nombre },
      {
        key: "modo", header: "Modo", width: "w-[90px]", render: (e) => (
          <span className="flex items-center gap-1">
            {getModoIcon(e.modo)} <span className="text-xs">{e.modo}</span>
          </span>
        ),
      },
      { key: "origen", header: "Origen", width: "w-[120px]", className: "text-xs", render: (e) => shortName(e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-") },
      { key: "destino", header: "Destino", width: "w-[120px]", className: "text-xs", render: (e) => shortName(e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-") },
      { key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.etd || "", render: (e) => formatDate(e.etd || "") },
      { key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.eta || "", render: (e) => formatDate(e.eta || "") },
      {
        key: "estado", header: "Estado", width: "w-[110px]", sortable: true, sortValue: (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado), render: (e) => {
          const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
          return <Badge variant="secondary" className={`text-xs ${getEstadoColor(estado)}`}>{estado}</Badge>;
        },
      },
      {
        key: "liquidacion", header: "Costos", width: "w-[90px]", render: (e) => getLiquidacionBadge(e.id),
      },
    ];

    if (canEdit) {
      base.push({
        key: "acciones",
        header: "",
        className: "w-10",
        render: (e) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(ev) => { ev.stopPropagation(); navigate(`/embarques/${e.id}/editar`); }}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(ev) => { ev.stopPropagation(); setEmbarqueADuplicar(e); }}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(ev) => { ev.stopPropagation(); setEmbarqueAEliminar(e); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }

    return base;
  }, [canEdit, liquidacionMap, docsMap]);

  const isEmptyState = !isLoading && totalCount === 0 && !debouncedSearch && filterModo === "todos" && filterEstado === "todos" && filterCliente === "todos" && filterOperador === "todos" && !fechaDesde && !fechaHasta;

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
                { key: "cliente_nombre", label: "Cliente" },
                { key: "modo", label: "Modo" },
                { key: "origen", label: "Origen" },
                { key: "destino", label: "Destino" },
                { key: "estado", label: "Estado" },
                { key: "etd", label: "ETD" },
                { key: "eta", label: "ETA" },
              ],
              filtered.map(e => ({
                expediente: e.expediente,
                cliente_nombre: e.cliente_nombre,
                modo: e.modo,
                origen: e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "",
                destino: e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "",
                estado: calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado),
                etd: e.etd || "",
                eta: e.eta || "",
              })),
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
              <div className="flex flex-wrap gap-4">
                <SearchInput
                  value={search}
                  onChange={(valor) => { setSearch(valor); setPage(0); }}
                  placeholder="Buscar por expediente, cliente o mercancía..."
                  className="flex-1 min-w-[200px]"
                />
                <Select value={filterModo} onValueChange={(v) => { setFilterModo(v); setPage(0); }}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Modo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los modos</SelectItem>
                    {MODOS_TRANSPORTE.map(m => <SelectItem key={m} value={m}>{getModoIcon(m)} {m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); setPage(0); }}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS_EMBARQUE.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCliente} onValueChange={(v) => { setFilterCliente(v); setPage(0); }}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los clientes</SelectItem>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterOperador} onValueChange={(v) => { setFilterOperador(v); setPage(0); }}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Operador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los operadores</SelectItem>
                    {operadoresUnicos.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" value={fechaDesde} onChange={(e) => { setFechaDesde(e.target.value); setPage(0); }} className="w-[150px]" placeholder="Desde (ETD)" title="ETD desde" />
                <Input type="date" value={fechaHasta} onChange={(e) => { setFechaHasta(e.target.value); setPage(0); }} className="w-[150px]" placeholder="Hasta (ETA)" title="ETA hasta" />
              </div>
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
                rowKey={(e) => e.id}
                rowClassName={() => "group"}
              />
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
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

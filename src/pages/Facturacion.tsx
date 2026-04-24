import { useState, useMemo } from "react";
import { Download, FileText, CheckCircle2 } from "lucide-react";
import { exportToCsv } from "@/generators/exportCsv";
import SearchInput from "@/components/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFacturas, useGastosPendientes, useMarcarCostoPagado } from "@/hooks/useFacturas";
import { useProformas, type ProformaRow } from "@/hooks/useProformas";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/uiMappings";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { DialogMarcarFacturada } from "@/components/facturacion/DialogMarcarFacturada";
import type { Database } from "@/integrations/supabase/types";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];
const ESTADOS_PROFORMA = ['Pendiente', 'Facturada', 'Cancelada'] as const;
const DEFAULT_PAGE_SIZE = 20;

type Factura = ReturnType<typeof useFacturas>["data"] extends (infer U)[] | undefined ? U : never;
type ProformaListItem = ReturnType<typeof useProformas>["data"] extends (infer U)[] | undefined ? U : never;

const facturaColumns: DataTableColumn<Factura>[] = [
  { key: "numero", header: "# Factura", width: "w-[110px]", className: "font-medium", sticky: true, sortable: true, sortValue: (f) => f.numero, render: (f) => f.numero },
  { key: "expediente", header: "Expediente", width: "w-[110px]", render: (f) => f.expediente },
  { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", render: (f) => f.cliente_nombre },
  { key: "monto", header: "Monto", width: "w-[110px]", className: "font-medium", sortable: true, sortValue: (f) => f.total, render: (f) => formatCurrency(f.total, f.moneda) },
  { key: "moneda", header: "Moneda", width: "w-[70px]", render: (f) => f.moneda },
  { key: "emision", header: "Emisión", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (f) => f.fecha_emision, render: (f) => formatDate(f.fecha_emision) },
  { key: "vencimiento", header: "Vencimiento", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (f) => f.fecha_vencimiento, render: (f) => formatDate(f.fecha_vencimiento) },
  { key: "estado", header: "Estado", width: "w-[100px]", sortable: true, sortValue: (f) => f.estado, render: (f) => <Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge> },
];

function getEstadoProformaColor(estado: string) {
  switch (estado) {
    case 'Pendiente': return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'Facturada': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    case 'Cancelada': return 'bg-gray-100 text-gray-700 border-gray-300';
    default: return '';
  }
}

export default function Facturacion() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Estado proformas
  const [searchPro, setSearchPro] = useState("");
  const [filterEstadoPro, setFilterEstadoPro] = useState<string>("Pendiente");
  const [pagePro, setPagePro] = useState(0);
  const [marcarOpen, setMarcarOpen] = useState(false);
  const [proformaSeleccionada, setProformaSeleccionada] = useState<{ id: string; numero: string } | null>(null);

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();
  const { data: proformas = [], isLoading: loadingProformas } = useProformas();
  const marcarPagado = useMarcarCostoPagado();
  const { canEdit } = usePermissions();
  const { toast } = useToast();

  const filtered = useMemo(() => {
    return facturas.filter(factura => {
      const matchSearch = !search || factura.numero.toLowerCase().includes(search.toLowerCase()) || factura.cliente_nombre.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || factura.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [search, filterEstado, facturas]);

  const filteredProformas = useMemo(() => {
    return proformas.filter(p => {
      const matchSearch = !searchPro || p.numero.toLowerCase().includes(searchPro.toLowerCase()) || p.cliente_nombre.toLowerCase().includes(searchPro.toLowerCase()) || (p.expediente || "").toLowerCase().includes(searchPro.toLowerCase());
      const matchEstado = filterEstadoPro === "todos" || p.estado === filterEstadoPro;
      return matchSearch && matchEstado;
    });
  }, [proformas, searchPro, filterEstadoPro]);

  const proformasPendientesCount = useMemo(() => proformas.filter(p => p.estado === 'Pendiente').length, [proformas]);

  const paginatedFacturas = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const paginatedProformas = filteredProformas.slice(pagePro * pageSize, (pagePro + 1) * pageSize);
  const totalPagesPro = Math.ceil(filteredProformas.length / pageSize);

  const registrarActividad = useRegistrarActividad();

  const handleMarcarPagado = (id: string) => {
    marcarPagado.mutate({ id }, {
      onSuccess: () => {
        registrarActividad.mutate({
          accion: 'editar',
          modulo: 'facturas',
          entidad_id: id,
          entidad_nombre: 'Gasto marcado como pagado',
        });
        toast({ title: "Gasto marcado como pagado" });
      },
      onError: () => toast({ title: "Error al marcar como pagado", variant: "destructive" }),
    });
  };

  type GastoPendiente = (typeof gastosPendientes)[number];

  const gastoColumns: DataTableColumn<GastoPendiente>[] = [
    { key: "proveedor", header: "Proveedor", width: "min-w-[160px]", sortable: true, sortValue: (g) => g.proveedor_nombre, render: (g) => g.proveedor_nombre },
    { key: "expediente", header: "Expediente", width: "w-[110px]", className: "font-medium", render: (g) => (g.embarques as { expediente: string } | null)?.expediente || "-" },
    { key: "concepto", header: "Concepto", width: "min-w-[140px]", render: (g) => g.concepto },
    { key: "monto", header: "Monto", width: "w-[110px]", className: "font-medium", sortable: true, sortValue: (g) => g.monto, render: (g) => formatCurrency(g.monto, g.moneda) },
    { key: "moneda", header: "Moneda", width: "w-[70px]", render: (g) => g.moneda },
    { key: "vencimiento", header: "Vencimiento", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (g) => g.fecha_vencimiento || "", render: (g) => g.fecha_vencimiento ? formatDate(g.fecha_vencimiento) : "-" },
    { key: "estado", header: "Estado", width: "w-[100px]", render: () => <Badge className={getEstadoColor("Pendiente")}>Pendiente</Badge> },
    {
      key: "acciones", header: "Acciones", render: (g) => canEdit ? (
        <Button variant="outline" size="sm" disabled={marcarPagado.isPending} onClick={() => handleMarcarPagado(g.id)}>
          Marcar Pagado
        </Button>
      ) : null,
    },
  ];

  const proformaColumns: DataTableColumn<ProformaListItem>[] = [
    { key: "numero", header: "# Proforma", width: "w-[140px]", className: "font-medium", sticky: true, sortable: true, sortValue: (p) => p.numero, render: (p) => p.numero },
    { key: "expediente", header: "Expediente", width: "w-[110px]", render: (p) => p.expediente || "-" },
    { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", render: (p) => p.cliente_nombre },
    { key: "monto", header: "Monto", width: "w-[110px]", className: "font-medium", sortable: true, sortValue: (p) => Number(p.total), render: (p) => formatCurrency(Number(p.total), p.moneda) },
    { key: "moneda", header: "Moneda", width: "w-[70px]", render: (p) => p.moneda },
    { key: "fecha", header: "Fecha", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (p) => p.created_at, render: (p) => formatDate(p.created_at.substring(0, 10)) },
    { key: "estado", header: "Estado", width: "w-[110px]", sortable: true, sortValue: (p) => p.estado, render: (p) => <Badge variant="outline" className={getEstadoProformaColor(p.estado)}>{p.estado}</Badge> },
    { key: "folio_externo", header: "Folio Fiscal", width: "w-[140px]", className: "text-xs", render: (p) => p.factura_externa_folio || "—" },
    {
      key: "acciones", header: "Acciones", width: "w-[200px]", render: (p) => (
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => generarPdfProforma(p as ProformaRow)}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          {canEdit && p.estado === 'Pendiente' && (
            <Button size="sm" onClick={() => { setProformaSeleccionada({ id: p.id, numero: p.numero }); setMarcarOpen(true); }}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Facturar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturación y Liquidación</h1>
        <p className="text-sm text-muted-foreground">Control de facturas, proformas y gastos por liquidar</p>
      </div>

      <Tabs defaultValue="proformas">
        <TabsList>
          <TabsTrigger value="proformas" className="gap-2">
            <FileText className="h-4 w-4" /> Proformas
            {proformasPendientesCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{proformasPendientesCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="liquidacion">Liquidación de Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="proformas" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <SearchInput value={searchPro} onChange={(v) => { setSearchPro(v); setPagePro(0); }} placeholder="Buscar proforma, cliente o expediente..." className="flex-1 min-w-[200px]" />
              <Select value={filterEstadoPro} onValueChange={(v) => { setFilterEstadoPro(v); setPagePro(0); }}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {ESTADOS_PROFORMA.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={proformaColumns}
                data={paginatedProformas}
                isLoading={loadingProformas}
                emptyMessage={filterEstadoPro === 'Pendiente' ? "No hay proformas pendientes de facturar" : "No se encontraron proformas"}
                rowKey={(p) => p.id}
              />
              <PaginationControls
                page={pagePro}
                totalPages={totalPagesPro}
                onPageChange={setPagePro}
                pageSize={pageSize}
                onPageSizeChange={(s) => { setPageSize(s); setPagePro(0); }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturas" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[200px]" />
              <Button variant="outline" onClick={() => exportToCsv(
                `facturas_${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  { key: "numero", label: "# Factura" },
                  { key: "expediente", label: "Expediente" },
                  { key: "cliente", label: "Cliente" },
                  { key: "total", label: "Monto" },
                  { key: "moneda", label: "Moneda" },
                  { key: "emision", label: "Emisión" },
                  { key: "vencimiento", label: "Vencimiento" },
                  { key: "estado", label: "Estado" },
                ],
                filtered.map(f => ({
                  numero: f.numero,
                  expediente: f.expediente,
                  cliente: f.cliente_nombre,
                  total: f.total,
                  moneda: f.moneda,
                  emision: f.fecha_emision,
                  vencimiento: f.fecha_vencimiento,
                  estado: f.estado,
                })),
              )}>
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ESTADOS_FACTURA.map(estadoFactura => <SelectItem key={estadoFactura} value={estadoFactura}>{estadoFactura}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={facturaColumns}
                data={paginatedFacturas}
                isLoading={loadingFacturas}
                emptyMessage="No se encontraron facturas"
                rowKey={(f) => f.id}
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
        </TabsContent>

        <TabsContent value="liquidacion">
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={gastoColumns}
                data={gastosPendientes}
                isLoading={loadingGastos}
                emptyMessage="No hay gastos pendientes"
                rowKey={(g) => g.id}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {proformaSeleccionada && (
        <DialogMarcarFacturada
          open={marcarOpen}
          onOpenChange={(v) => { setMarcarOpen(v); if (!v) setProformaSeleccionada(null); }}
          proformaId={proformaSeleccionada.id}
          proformaNumero={proformaSeleccionada.numero}
        />
      )}
    </div>
  );
}

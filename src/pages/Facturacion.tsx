import { useState, useMemo } from "react";
import { Download, FileText, FileCode2 } from "lucide-react";
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
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import type { Database } from "@/integrations/supabase/types";
import { TabProformas } from "@/components/facturacion/TabProformas";
import { TabProformasPendientes } from "@/components/facturacion/TabProformasPendientes";
import { useProformasPendientes } from "@/hooks/embarque/useProformas";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];
const DEFAULT_PAGE_SIZE = 20;

type Factura = ReturnType<typeof useFacturas>["data"] extends (infer U)[] | undefined ? U : never;

const facturaColumns: DataTableColumn<Factura>[] = [
  { key: "numero", header: "# Factura", width: "w-[110px]", className: "font-medium", sticky: true, sortable: true, sortValue: (f) => f.numero, render: (f) => f.numero },
  { key: "expediente", header: "Expediente", width: "w-[110px]", render: (f) => f.expediente },
  {
    key: "proforma", header: "Proforma", width: "w-[130px]", className: "text-xs",
    render: (f) => f.proformas?.numero
      ? <span className="font-mono">{f.proformas.numero}</span>
      : <span className="text-muted-foreground">—</span>,
  },
  { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", render: (f) => f.cliente_nombre },
  { key: "monto", header: "Monto", width: "w-[110px]", className: "font-medium", sortable: true, sortValue: (f) => f.total, render: (f) => formatCurrency(f.total, f.moneda) },
  { key: "moneda", header: "Moneda", width: "w-[70px]", render: (f) => f.moneda },
  { key: "emision", header: "Emisión", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (f) => f.fecha_emision, render: (f) => formatDate(f.fecha_emision) },
  { key: "vencimiento", header: "Vencimiento", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (f) => f.fecha_vencimiento, render: (f) => formatDate(f.fecha_vencimiento) },
  { key: "estado", header: "Estado", width: "w-[100px]", sortable: true, sortValue: (f) => f.estado, render: (f) => <Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge> },
  {
    key: "archivos", header: "Archivos", width: "w-[110px]",
    render: (f) => {
      if (!f.factura_pdf_url && !f.factura_xml_url) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex items-center gap-1">
          {f.factura_pdf_url && (
            <Button asChild variant="outline" size="icon" className="h-7 w-7" title="Descargar PDF">
              <a href={f.factura_pdf_url} target="_blank" rel="noopener noreferrer" download>
                <FileText className="h-3.5 w-3.5 text-red-600" />
              </a>
            </Button>
          )}
          {f.factura_xml_url && (
            <Button asChild variant="outline" size="icon" className="h-7 w-7" title="Descargar XML">
              <a href={f.factura_xml_url} target="_blank" rel="noopener noreferrer" download>
                <FileCode2 className="h-3.5 w-3.5 text-blue-600" />
              </a>
            </Button>
          )}
        </div>
      );
    },
  },
];

export default function Facturacion() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();
  const { data: proformasPendientes = [] } = useProformasPendientes();
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

  const paginatedFacturas = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pre-Facturación</h1>
        <p className="text-sm text-muted-foreground">Control de proformas, facturas emitidas y gastos por liquidar</p>
      </div>

      <Tabs defaultValue={proformasPendientes.length > 0 ? "pendientes" : "proformas"}>
        <TabsList>
          <TabsTrigger value="pendientes">
            Pendientes{proformasPendientes.length > 0 ? ` (${proformasPendientes.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="proformas">Proformas</TabsTrigger>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="liquidacion">Liquidación de Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes">
          <TabProformasPendientes />
        </TabsContent>

        <TabsContent value="proformas">
          <TabProformas />
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
    </div>
  );
}

import { Download } from "lucide-react";
import { FacturaDownloadButton } from "@/components/facturacion/FacturaDownloadButton";
import SearchInput from "@/components/selects/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFacturas } from "@/hooks/facturacion";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Database } from "@/types/db";
import { TabProformas } from "@/components/facturacion/TabProformas";
import { TabProformasPendientes } from "@/components/facturacion/TabProformasPendientes";
import { TabProyeccion } from "@/components/facturacion/TabProyeccion";
import { useFacturacionPageController } from "@/hooks/facturacion";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];

type Factura = ReturnType<typeof useFacturas>["data"] extends (infer U)[] | undefined ? U : never;

const facturaColumns: ColumnDef<Factura, unknown>[] = defineColumns<Factura>([
  {
    id: "numero", header: "# Factura",
    accessorFn: (f) => f.numero, enableSorting: true,
    sortingFn: sortByString<Factura>((f) => f.numero),
    meta: { width: "w-[110px]", className: "font-medium whitespace-nowrap", sticky: true },
    cell: ({ row }) => row.original.numero,
  },
  { id: "expediente", header: "Expediente", meta: { width: "w-[110px]", className: "whitespace-nowrap" }, cell: ({ row }) => row.original.expediente },
  {
    id: "proforma", header: "Proforma",
    meta: { width: "w-[140px]", className: "text-xs whitespace-nowrap" },
    cell: ({ row }) => row.original.proformas?.numero
      ? <span className="font-mono">{row.original.proformas.numero}</span>
      : <span className="text-muted-foreground">—</span>,
  },
  {
    id: "cliente", header: "Cliente",
    meta: { width: "min-w-[160px]", className: "max-w-[200px] truncate" },
    cell: ({ row }) => <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>,
  },
  {
    id: "monto", header: "Monto",
    accessorFn: (f) => f.total, enableSorting: true,
    sortingFn: sortByNumber<Factura>((f) => f.total),
    meta: { width: "w-[130px]", align: "right", className: "font-medium whitespace-nowrap tabular-nums" },
    cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda),
  },
  {
    id: "emision", header: "Emisión",
    accessorFn: (f) => f.fecha_emision, enableSorting: true,
    sortingFn: sortByDate<Factura>((f) => f.fecha_emision),
    meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
    cell: ({ row }) => formatDate(row.original.fecha_emision),
  },
  {
    id: "vencimiento", header: "Vencimiento",
    accessorFn: (f) => f.fecha_vencimiento, enableSorting: true,
    sortingFn: sortByDate<Factura>((f) => f.fecha_vencimiento),
    meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
    cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
  },
  {
    id: "estado", header: "Estado",
    accessorFn: (f) => f.estado, enableSorting: true,
    sortingFn: sortByString<Factura>((f) => f.estado),
    meta: { width: "w-[100px]" },
    cell: ({ row }) => <Badge className={getEstadoColor(row.original.estado)}>{row.original.estado}</Badge>,
  },
  {
    id: "archivos", header: "Archivos",
    meta: { width: "w-[110px]" },
    cell: ({ row }) => {
      const f = row.original;
      if (!f.factura_pdf_url && !f.factura_xml_url) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex items-center gap-1">
          {f.factura_pdf_url && <FacturaDownloadButton stored={f.factura_pdf_url} kind="pdf" />}
          {f.factura_xml_url && <FacturaDownloadButton stored={f.factura_xml_url} kind="xml" />}
        </div>
      );
    },
  },
]);

export default function Facturacion() {
  const {
    search, setSearch,
    filterEstado, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, totalPages,
    gastosPendientes, proformasPendientes,
    loadingFacturas, loadingGastos,
    canEdit, marcarPagadoPending,
    handleMarcarPagado, exportarFacturasCsv, exportarLayoutContable,
  } = useFacturacionPageController();

  type GastoPendiente = (typeof gastosPendientes)[number];

  const gastoColumns: ColumnDef<GastoPendiente, unknown>[] = defineColumns<GastoPendiente>([
    {
      id: "proveedor", header: "Proveedor",
      accessorFn: (g) => g.proveedor_nombre, enableSorting: true,
      sortingFn: sortByString<GastoPendiente>((g) => g.proveedor_nombre),
      meta: { width: "min-w-[180px]", className: "max-w-[220px] truncate" },
      cell: ({ row }) => <span title={toTitleCase(row.original.proveedor_nombre)}>{toTitleCase(row.original.proveedor_nombre)}</span>,
    },
    {
      id: "expediente", header: "Expediente",
      meta: { width: "w-[110px]", className: "font-medium whitespace-nowrap" },
      cell: ({ row }) => (row.original.embarques as { expediente: string } | null)?.expediente || "-",
    },
    {
      id: "concepto", header: "Concepto",
      meta: { width: "min-w-[140px]" },
      cell: ({ row }) => row.original.concepto,
    },
    {
      id: "monto", header: "Monto",
      accessorFn: (g) => g.monto, enableSorting: true,
      sortingFn: sortByNumber<GastoPendiente>((g) => g.monto),
      meta: { width: "w-[140px]", align: "right", className: "font-medium whitespace-nowrap tabular-nums" },
      cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda),
    },
    {
      id: "vencimiento", header: "Vencimiento",
      accessorFn: (g) => g.fecha_vencimiento, enableSorting: true,
      sortingFn: sortByDate<GastoPendiente>((g) => g.fecha_vencimiento),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "-",
    },
    {
      id: "estado", header: "Estado",
      meta: { width: "w-[100px]" },
      cell: () => <Badge className={getEstadoColor("Pendiente")}>Pendiente</Badge>,
    },
    {
      id: "acciones", header: "Acciones",
      cell: ({ row }) => canEdit ? (
        <Button variant="outline" size="sm" disabled={marcarPagadoPending} onClick={() => handleMarcarPagado(row.original.id)}>
          Marcar Pagado
        </Button>
      ) : null,
    },
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-Facturación"
        description="Control de proformas, facturas emitidas y gastos por liquidar"
      />

      <Tabs defaultValue="proyeccion">
        <TabsList>
          <TabsTrigger value="proyeccion">Proyección</TabsTrigger>
          <TabsTrigger value="pendientes">
            Pendientes{proformasPendientes.length > 0 ? ` (${proformasPendientes.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="proformas">Proformas</TabsTrigger>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="liquidacion">Liquidación de Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="proyeccion">
          <TabProyeccion />
        </TabsContent>

        <TabsContent value="pendientes">
          <TabProformasPendientes />
        </TabsContent>

        <TabsContent value="proformas">
          <TabProformas />
        </TabsContent>

        <TabsContent value="facturas" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[200px]" />
              <Button variant="outline" onClick={exportarFacturasCsv}>
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
              <Button variant="outline" onClick={exportarLayoutContable} title="Layout contable con RFC, subtotal, IVA y total — para el contador">
                <Download className="h-4 w-4 mr-2" /> Layout contable
              </Button>
              <Select value={filterEstado} onValueChange={(v) => setFilter("estado", v)}>
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
                density="comfortable"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

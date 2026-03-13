import { useState, useMemo } from "react";
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
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import type { Database } from "@/integrations/supabase/types";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];
const DEFAULT_PAGE_SIZE = 20;

type Factura = ReturnType<typeof useFacturas>["data"] extends (infer U)[] | undefined ? U : never;

const facturaColumns: DataTableColumn<Factura>[] = [
  { key: "numero", header: "# Factura", className: "font-medium", render: (f) => f.numero },
  { key: "expediente", header: "Expediente", render: (f) => f.expediente },
  { key: "cliente", header: "Cliente", className: "max-w-[180px] truncate", render: (f) => f.cliente_nombre },
  { key: "monto", header: "Monto", className: "font-medium", render: (f) => formatCurrency(f.total, f.moneda) },
  { key: "moneda", header: "Moneda", render: (f) => f.moneda },
  { key: "emision", header: "Emisión", className: "text-xs", render: (f) => formatDate(f.fecha_emision) },
  { key: "vencimiento", header: "Vencimiento", className: "text-xs", render: (f) => formatDate(f.fecha_vencimiento) },
  { key: "estado", header: "Estado", render: (f) => <Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge> },
];

export default function Facturacion() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();
  const marcarPagado = useMarcarCostoPagado();
  const { canEdit } = usePermissions();

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
        toast.success("Gasto marcado como pagado");
      },
      onError: () => toast.error("Error al marcar como pagado"),
    });
  };

  type GastoPendiente = (typeof gastosPendientes)[number];

  const gastoColumns: DataTableColumn<GastoPendiente>[] = [
    { key: "proveedor", header: "Proveedor", render: (g) => g.proveedor_nombre },
    { key: "expediente", header: "Expediente", className: "font-medium", render: (g) => (g.embarques as { expediente: string } | null)?.expediente || "-" },
    { key: "concepto", header: "Concepto", render: (g) => g.concepto },
    { key: "monto", header: "Monto", className: "font-medium", render: (g) => formatCurrency(g.monto, g.moneda) },
    { key: "moneda", header: "Moneda", render: (g) => g.moneda },
    { key: "vencimiento", header: "Vencimiento", className: "text-xs", render: (g) => g.fecha_vencimiento ? formatDate(g.fecha_vencimiento) : "-" },
    { key: "estado", header: "Estado", render: () => <Badge className={getEstadoColor("Pendiente")}>Pendiente</Badge> },
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
        <h1 className="text-2xl font-bold">Facturación y Liquidación</h1>
        <p className="text-sm text-muted-foreground">Control de facturas emitidas y gastos por liquidar</p>
      </div>

      <Tabs defaultValue="facturas">
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="liquidacion">Liquidación de Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[200px]" />
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

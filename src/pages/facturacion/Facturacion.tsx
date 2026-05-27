import { useMemo } from "react";
import { Download } from "lucide-react";
import SearchInput from "@/components/selects/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/DataTable";
import { PageHeader } from "@/components/shared/PageHeader";
import type { Database } from "@/types/db";
import { TabProformas } from "@/components/facturacion/TabProformas";
import { TabProformasPendientes } from "@/components/facturacion/TabProformasPendientes";
import { TabProyeccion } from "@/components/facturacion/TabProyeccion";
import { DateRangeFilter } from "@/components/facturacion/DateRangeFilter";
import { useFacturacionPageController } from "@/hooks/facturacion";
import { useFacturacionDateRange } from "@/hooks/facturacion/useFacturacionDateRange";
import { facturaColumns, buildGastoColumns } from "./facturacionColumns";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];

export default function Facturacion() {
  const { range, setRango, limpiar, isInRange, activo } = useFacturacionDateRange();

  const {
    search, setSearch,
    filterEstado, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, totalPages,
    gastosPendientes, proformasPendientes,
    loadingFacturas, loadingGastos,
    canEdit, marcarPagadoPending,
    handleMarcarPagado, exportarFacturasCsv, exportarLayoutContable,
  } = useFacturacionPageController({ isInRange });

  const gastoColumns = useMemo(
    () => buildGastoColumns({ canEdit, marcarPagadoPending, handleMarcarPagado }),
    [canEdit, marcarPagadoPending, handleMarcarPagado],
  );


  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-Facturación"
        description="Control de proformas, facturas emitidas y gastos por liquidar"
      />

      <Card>
        <CardContent className="p-3">
          <DateRangeFilter range={range} onChange={setRango} onClear={limpiar} activo={activo} />
        </CardContent>
      </Card>


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
          <TabProformasPendientes isInRange={isInRange} />
        </TabsContent>

        <TabsContent value="proformas">
          <TabProformas isInRange={isInRange} />
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
                  pageSizeOptions: [100, 999999],
                  pageSizeLabels: { 999999: "Todos" },
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

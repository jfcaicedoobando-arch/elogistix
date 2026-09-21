/**
 * /compras/pagos — Ola E. Listado global de pagos a proveedor.
 *
 * Muestra todos los pagos aplicados, con filtros por rango de fechas,
 * método de pago, moneda y búsqueda por folio/proveedor/referencia.
 * KPIs de total pagado (MXN, USD) y conteo. Exporta a CSV.
 *
 * P1-B: datos/estado/exportación viven en `useComprasPagosController`.
 */
import { useMemo } from "react";
import { Landmark, Download, Banknote, Coins, ListFilter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import { buildPagosColumns } from "./_sections/pagosColumns";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";
import {
  useComprasPagosController,
  type MonedaFiltro,
} from "../hooks/useComprasPagosController";

export default function ComprasPagos() {
  const {
    desde, setDesde, hasta, setHasta,
    moneda, setMoneda, metodoPago, setMetodoPago, search, setSearch,
    rows, isLoading, isError, refetch,
    metodosDisponibles, totalMxn, totalUsd, handleExport,
  } = useComprasPagosController();

  const columns = useMemo(() => buildPagosColumns(), []);

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<Landmark className="h-6 w-6 text-accent" />}
        title="Pagos a proveedor"
        description="Listado global de pagos aplicados a facturas de proveedor."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Pagos en el período" value={String(rows.length)} icon={ListFilter} />
        <KpiCard label="Total MXN" value={formatCurrency(totalMxn, "MXN")} icon={Banknote} />
        <KpiCard label="Total USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="p-desde">{RANGO_DESDE_LABEL}</Label>
            <DatePickerMx value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-hasta">{RANGO_HASTA_LABEL}</Label>
            <DatePickerMx value={hasta} onChange={setHasta} />
          </div>
          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Método de pago</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {metodosDisponibles.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>Buscar</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio o proveedor…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <ErrorState className="m-4" onRetry={() => void refetch()} />
          ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay pagos en el período seleccionado"
            emptyHint="Ajusta el rango de fechas o los filtros para ver resultados."
            emptyIcon={Landmark}
            rowKey={(r) => r.id}
            density={TABLE_DENSITY.embebida}
          />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

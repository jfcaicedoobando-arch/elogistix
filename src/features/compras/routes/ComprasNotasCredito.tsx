/**
 * /compras/notas-credito — Ola E. Listado global de notas de crédito de proveedor.
 *
 * P1-B: filtros, consulta, KPIs y exportación viven en
 * `useComprasNotasCreditoController`.
 */
import { useMemo } from "react";
import { ReceiptText, Download, Banknote, Coins, ListFilter } from "lucide-react";
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
import { buildNotasCreditoColumns } from "./_sections/notasCreditoColumns";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";
import {
  useComprasNotasCreditoController,
  type EstadoFiltro,
  type MonedaFiltro,
} from "../hooks/useComprasNotasCreditoController";

export default function ComprasNotasCredito() {
  const {
    desde, setDesde, hasta, setHasta,
    moneda, setMoneda, estado, setEstado, search, setSearch,
    rows, isLoading, isError, refetch,
    totalMxn, totalUsd, handleExport,
  } = useComprasNotasCreditoController();

  const columns = useMemo(() => buildNotasCreditoColumns(), []);

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<ReceiptText className="h-6 w-6 text-accent" />}
        title="Notas de crédito de proveedor"
        description="Listado global de notas de crédito. Sólo las Aplicadas reducen el saldo a pagar."
        actions={
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="NC en el período" value={String(rows.length)} icon={ListFilter} />
        <KpiCard label="Aplicadas MXN" value={formatCurrency(totalMxn, "MXN")} icon={Banknote} variant="success" />
        <KpiCard label="Aplicadas USD" value={formatCurrency(totalUsd, "USD")} icon={Coins} variant="success" />
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nc-desde">{RANGO_DESDE_LABEL}</Label>
            <DatePickerMx value={desde} onChange={setDesde} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nc-hasta">{RANGO_HASTA_LABEL}</Label>
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
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="Emitida">Emitida</SelectItem>
                <SelectItem value="Aplicada">Aplicada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label>Buscar</Label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio NC o factura…" />
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
            emptyMessage="No hay notas de crédito en el período"
            emptyHint="Ajusta el rango de fechas o los filtros para ver resultados."
            emptyIcon={ReceiptText}
            rowKey={(r) => r.id}
            density={TABLE_DENSITY.embebida}
          />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

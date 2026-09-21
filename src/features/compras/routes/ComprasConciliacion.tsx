/**
 * /compras/conciliacion — Ola D. Conciliación factura ↔ embarque.
 *
 * Muestra el estatus de cobertura de facturación de proveedor sobre los
 * conceptos_costo de cada embarque activo. Permite filtrar por estado
 * (sin_facturar / parcial / completa), moneda y buscar por expediente/cliente.
 * Un click en una fila lleva al detalle del embarque para operar los conceptos.
 *
 * P1-B: filtros, consulta y KPIs viven en `useComprasConciliacionController`.
 */
import { useMemo } from "react";
import { GitCompare, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import { buildConciliacionColumns } from "./_sections/conciliacionColumns";
import { ConciliacionDetalleSheet } from "./_sections/ConciliacionDetalleSheet";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";
import {
  useComprasConciliacionController,
  type EstadoFiltro,
  type MonedaFiltro,
} from "../hooks/useComprasConciliacionController";

export default function ComprasConciliacion() {
  const {
    estado, setEstado, moneda, setMoneda, search, setSearch,
    detalle, setDetalle,
    rows, isLoading, isError, error, refetch, kpis,
  } = useComprasConciliacionController();

  const columns = useMemo(() => buildConciliacionColumns(), []);

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<GitCompare className="h-6 w-6" />}
        title="Conciliación con embarques"
        description="Presupuesto (conceptos de costo) vs facturación real de proveedor por embarque."
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Sin facturar" value={kpis.sinFacturar} icon={AlertTriangle} variant="destructive" />
        <KpiCard label="Parciales" value={kpis.parcial} icon={Clock} variant="warning" />
        <KpiCard label="Conciliadas" value={kpis.completa} icon={CheckCircle2} variant="success" />
        <KpiCard label="Pendiente MXN" value={formatCurrency(kpis.pendienteMxn, "MXN")} />
        <KpiCard label="Pendiente USD" value={formatCurrency(kpis.pendienteUsd, "USD")} />
        <KpiCard label="Pendiente EUR" value={formatCurrency(kpis.pendienteEur, "EUR")} />

      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Estado conciliación</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="sin_facturar">Sin facturar</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="completa">Conciliadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={moneda} onValueChange={(v) => setMoneda(v as MonedaFiltro)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Buscar</Label>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Expediente o cliente…"
              />
            </div>
          </div>

          {isError ? (
            error instanceof ResultadoTruncadoError ? (
              <ErrorState
                onRetry={() => void refetch()}
                title="Conciliación con demasiados registros para mostrarse completa"
                description="Hay más conceptos de costo de los que este reporte puede leer de forma segura. Aplica filtros (moneda, estado, cliente) para acotar el resultado; nunca se muestra un total parcial."
              />
            ) : (
              <ErrorState onRetry={() => void refetch()} />
            )
          ) : (
          <DataTable
            columns={columns}
            data={rows}
            isLoading={isLoading}
            emptyMessage="No hay embarques con conceptos de costo para conciliar."
            rowKey={(r) => `${r.embarque_id}-${r.moneda}`}
            onRowClick={(row) => setDetalle(row)}
            stickyHeader
          />
          )}
        </CardContent>
      </Card>

      <ConciliacionDetalleSheet embarque={detalle} onClose={() => setDetalle(null)} />
    </PageContainer>
  );
}

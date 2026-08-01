/**
 * Cartera — facturas emitidas con saldo pendiente.
 *
 * v13.173.0 (Ola 1 · Filtros globales): migrada al primitivo unificado
 * `useClientPagedList` — search, filtros (moneda / vencidas), rango de fechas
 * de vencimiento, orden y paginación sincronizados con la URL vía `nuqs`, y
 * barra `<UnifiedFiltersBar />` compartida con Facturación/Embarques.
 * v13.313.1: agregado diálogo de recordatorio de cobranza.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Inbox } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useCarteraPage } from "@/features/bandejas/hooks/useCarteraPage";
import { type SaldosPorMonedaCartera } from "@/features/bandejas/domain/aggregates";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { CarteraMobileList } from "./_sections/CarteraMobileList";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { DialogRecordatorioCobranza, type FacturaRecordatorio } from "@/features/cobranza/components/DialogRecordatorioCobranza";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL, rangoLabel } from "@/lib/ui/rangoFechasCopy";

/** Formatea saldos nativos como "$X MXN · $Y USD" (omite ceros). */
function formatNativos(b: SaldosPorMonedaCartera): string {
  const parts: string[] = [];
  if (b.MXN > 0) parts.push(formatCurrency(b.MXN, "MXN"));
  if (b.USD > 0) parts.push(formatCurrency(b.USD, "USD"));
  for (const [cod, monto] of Object.entries(b.otras)) {
    if (monto > 0) parts.push(formatCurrency(monto, cod));
  }
  return parts.length > 0 ? parts.join(" · ") : formatCurrency(0, "MXN");
}

export default function Cartera() {
  const [recordatorio, setRecordatorio] = useState<FacturaRecordatorio | null>(null);
  const {
    paged,
    monedas,
    scoped,
    saldosNativos,
    vencidasCount,
    vencidoNativo,
    eqTotal,
    eqVencido,
    isLoading,
    columns,
  } = useCarteraPage((row) => setRecordatorio(row));

  return (
    <PageContainer>
      <PageHeader
        title="Cartera"
        description="Facturas vencidas y por vencer en los próximos 7 días. Cambia el filtro de urgencia para ver toda la cartera."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas en foco</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{scoped.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatNativos(saldosNativos)}</div>
            <div
              className="text-xs text-muted-foreground mt-1"
              title={eqTotal.facturasSinTc > 0 ? `${eqTotal.facturasSinTc} moneda(s) sin tipo de cambio` : undefined}
            >
              ≈ {formatCurrency(eqTotal.totalMxn, "MXN")} equivalente
              {eqTotal.facturasSinTc > 0 && <span className="ml-1">({eqTotal.facturasSinTc} sin TC)</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencido ({vencidasCount})</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-destructive tabular-nums">{formatNativos(vencidoNativo)}</div>
            <div
              className="text-xs text-muted-foreground mt-1"
              title={eqVencido.facturasSinTc > 0 ? `${eqVencido.facturasSinTc} moneda(s) sin tipo de cambio` : undefined}
            >
              ≈ {formatCurrency(eqVencido.totalMxn, "MXN")} equivalente
              {eqVencido.facturasSinTc > 0 && <span className="ml-1">({eqVencido.facturasSinTc} sin TC)</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar folio, cliente o expediente…"
        primary={
          <>
            <Select value={paged.filters.urgencia} onValueChange={(v) => paged.setFilter("urgencia", v)}>
              <SelectTrigger className="w-[200px]" aria-label="Urgencia">
                <SelectValue placeholder="Urgencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accionable">Accionable (≤7d o vencidas)</SelectItem>
                <SelectItem value="vencidas">Solo vencidas</SelectItem>
                <SelectItem value="por_vencer">Por vencer (≤7 días)</SelectItem>
                <SelectItem value="todas">Todas con saldo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paged.filters.moneda} onValueChange={(v) => paged.setFilter("moneda", v)}>
              <SelectTrigger className="w-[140px]" aria-label="Moneda">
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas monedas</SelectItem>
                {monedas.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        secondary={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cartera-from">{rangoLabel("Vencimiento", "desde")}</Label>
              <DatePickerMx value={paged.dateFrom} onChange={paged.setDateFrom} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartera-to">{rangoLabel("Vencimiento", "hasta")}</Label>
              <DatePickerMx value={paged.dateTo} onChange={paged.setDateTo} />
            </div>
          </div>
        }
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      {/* Mobile: lista de tarjetas (sm:hidden). Las cifras nunca quedan cortadas. */}
      <CarteraMobileList rows={paged.rows} isLoading={isLoading} />

      {/* Desktop / tablet: DataTable unificada con orden + paginación server-tagged. */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paged.rows}
            rowKey={(r) => r.factura_id}
            isLoading={paged.isLoading}
            getRowHref={(r) => `/facturacion/${r.factura_id}`}
            getRowAriaLabel={(r) => `Ver factura ${r.numero ?? ""}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            emptyIcon={Inbox}
            emptyMessage="Sin cartera pendiente"
            emptyHint="¡Todo cobrado!"
          />
        </CardContent>
      </Card>

      <DialogRecordatorioCobranza
        open={recordatorio !== null}
        onOpenChange={(open) => !open && setRecordatorio(null)}
        factura={recordatorio}
      />
    </PageContainer>
  );
}

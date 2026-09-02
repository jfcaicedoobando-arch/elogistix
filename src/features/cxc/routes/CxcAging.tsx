/**
 * Página de Antigüedad de Saldos (aging) de CxC.
 * Ruta: `/cobranza/aging`. Tabla por cliente + 5 KPIs por cubeta.
 *
 * v13.462.0 — Armonización de las tres vistas de antigüedad:
 * selector de moneda (MXN/USD/EUR no se mezclan), fecha de corte, drill-down
 * por cliente, KPIs y cubetas compartidas con CxP y el reporte contable.
 */
import { useMemo, useState } from "react";
import { LayoutList, Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { CargaGuard } from "@/components/shared/states/CargaGuard";

import { buildCxcAgingColumns } from "@/features/cxc/components/cxcAgingColumns";
import { CxcAgingDrillDownDialog } from "@/features/cxc/components/CxcAgingDrillDownDialog";
import { useCxcAging } from "@/features/cxc/hooks/useCxcAging";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";
import { todayLocalISO } from "@/lib/date/today";
import { exportarCxcAgingCsv } from "@/features/cxc/services/cxcAgingExport";
import { AgingMonedaFechaBar } from "@/components/shared/aging/AgingMonedaFechaBar";
import {
  CUBETAS_AGING, CUBETA_LABELS_LARGAS, CUBETA_TONO_KPI, type CubetaAging,
} from "@/lib/aging/buckets";
import { AgingKpiBucket } from "@/components/shared/kpi/AgingKpiBucket";
import { CxcAgingMobileCard } from "@/features/cxc/components/CxcAgingMobileCard";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { Link } from "react-router-dom";

interface Filters extends Record<string, string> { cubeta: string }
const DEFAULTS: Filters = { cubeta: "todas" };

export default function CxcAging() {
  const [fecha, setFecha] = useState<string>(() => todayLocalISO());
  const aging = useCxcAging(fecha);
  const {
    rowsFiltradas, isLoading, totales, isError, refetch, monedas, monedaActiva, setMoneda,
  } = aging;
  const columns = useMemo(() => buildCxcAgingColumns(monedaActiva), [monedaActiva]);
  const [drilldown, setDrilldown] = useState<{ cli: CxcAgingRow; cubeta: CubetaAging | "todas" } | null>(null);

  const paged = useClientPagedList<CxcAgingRow, Filters>({
    data: rowsFiltradas,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { cubeta: "Con saldo en" },
    defaultSort: { key: "saldo", dir: "desc" },
    searchAccessor: (r) => r.cliente_nombre,
    filterPredicate: (r, ff) => {
      switch (ff.cubeta) {
        case "vigente": return r.vigente > 0;
        case "1_30":    return r.d_1_30 > 0;
        case "31_60":   return r.d_31_60 > 0;
        case "61_90":   return r.d_61_90 > 0;
        case "mas_90":  return r.mas_90 > 0;
        default: return true;
      }
    },
    sorters: {
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      facturas: (a, b) => a.num_facturas - b.num_facturas,
      vigente: (a, b) => a.vigente - b.vigente,
      d_1_30: (a, b) => a.d_1_30 - b.d_1_30,
      d_31_60: (a, b) => a.d_31_60 - b.d_31_60,
      d_61_90: (a, b) => a.d_61_90 - b.d_61_90,
      mas_90: (a, b) => a.mas_90 - b.mas_90,
      saldo: (a, b) => a.saldo_total - b.saldo_total,
    },
  });

  return (
    <PageContainer width="wide">
      <PageHeader
        icon={<LayoutList className="h-6 w-6 text-accent" />}
        title="Antigüedad de saldos"
        description={`Saldos por cliente agrupados por días de vencimiento (${monedaActiva}).`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/reportes/cartera">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Reporte contable
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarCxcAgingCsv(rowsFiltradas, monedaActiva, fecha)}
              disabled={rowsFiltradas.length === 0}
            >
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        }
      />

      <AgingMonedaFechaBar
        monedas={monedas}
        monedaActiva={monedaActiva}
        onMonedaChange={setMoneda}
        fecha={fecha}
        onFechaChange={setFecha}
        idFecha="aging-cxc-corte"
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar la antigüedad de saldos"
        errorDescription="Ocurrió un error al obtener los saldos de clientes. Intenta de nuevo."
      >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {CUBETAS_AGING.map((b) => (
          <AgingKpiBucket
            key={b}
            label={CUBETA_LABELS_LARGAS[b]}
            value={totales[b]}
            moneda={monedaActiva}
            tone={totales[b] > 0 ? CUBETA_TONO_KPI[b] : "default"}
          />
        ))}
      </div>

      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar cliente…"
        primary={
          <Select value={paged.filters.cubeta} onValueChange={(v) => paged.setFilter("cubeta", v)}>
            <SelectTrigger className="w-[180px]" aria-label="Cubeta">
              <SelectValue placeholder="Con saldo en" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las cubetas</SelectItem>
              <SelectItem value="vigente">Solo vigente</SelectItem>
              <SelectItem value="1_30">1-30 días</SelectItem>
              <SelectItem value="31_60">31-60 días</SelectItem>
              <SelectItem value="61_90">61-90 días</SelectItem>
              <SelectItem value="mas_90">+90 días</SelectItem>
            </SelectContent>
          </Select>
        }
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      <Card>
        <CardContent className="p-0">
          {/* v13.823.25: ResponsiveDataTable evita el desbordamiento horizontal en móvil/plegable. */}
          <ResponsiveDataTable<CxcAgingRow>
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            rowKey={(r) => `${r.cliente_id}-${r.moneda}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            onRowClick={(r) => setDrilldown({ cli: r, cubeta: "todas" })}
            getRowAriaLabel={(r) => `Ver facturas con saldo de ${r.cliente_nombre}`}
            emptyMessage="Sin saldos pendientes"
            emptyHint="No hay facturas con saldo abierto."
            striped
            hoverable
            density={TABLE_DENSITY.embebida}
            mobileCard={(r) => <CxcAgingMobileCard row={r} />}
          />
        </CardContent>
      </Card>
      </CargaGuard>

      <CxcAgingDrillDownDialog
        open={!!drilldown}
        onOpenChange={(o) => !o && setDrilldown(null)}
        cliente={drilldown?.cli ?? null}
        cubetaInicial={drilldown?.cubeta ?? "todas"}
      />
    </PageContainer>
  );
}

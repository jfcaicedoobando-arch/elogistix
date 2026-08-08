/**
 * Página de Antigüedad de Saldos (aging) de CxP.
 * Ruta: `/compras/aging`. Tabla por proveedor + 5 KPIs por cubeta.
 *
 * v13.173.0 (Ola 1 · Filtros globales) — search + filtro de cubeta + orden +
 * paginación con URL sync a través de `useClientPagedList` y
 * `<UnifiedFiltersBar />`.
 */
import { useMemo, useState } from "react";
import { LayoutList, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";

import { buildCxpAgingColumns } from "@/features/cxp/components/cxpAgingColumns";
import { useCxpAging } from "@/features/cxp/hooks/useCxpAging";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";

import { AgingDrillDownDialog } from "@/features/cxp/components/AgingDrillDownDialog";
import type { CubetaAging } from "@/features/cxp/components/agingBuckets";
import { todayLocalISO } from "@/lib/date/today";
import { exportarCxpAgingCsv } from "@/features/cxp/services/cxpAgingExport";
import { AgingMonedaFechaBar } from "@/components/shared/aging/AgingMonedaFechaBar";
import { Link } from "react-router-dom";
import { FileSpreadsheet } from "lucide-react";
import {
  CUBETAS_AGING, CUBETA_LABELS_LARGAS, CUBETA_TONO_KPI,
} from "@/lib/aging/buckets";

import { AgingKpiBucket } from "@/components/shared/kpi/AgingKpiBucket";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";


interface Filters extends Record<string, string> { cubeta: string }
const DEFAULTS: Filters = { cubeta: "todas" };

export default function CxpAging() {
  const [fecha, setFecha] = useState<string>(() => todayLocalISO());
  const aging = useCxpAging(fecha);
  const { rowsFiltradas, isLoading, totales, monedas, monedaActiva, setMoneda } = aging;
  const columns = useMemo(() => buildCxpAgingColumns(), []);
  const [drilldown, setDrilldown] = useState<{ prov: CxpAgingRow; cubeta: CubetaAging | "todas" } | null>(null);

  const paged = useClientPagedList<CxpAgingRow, Filters>({
    data: rowsFiltradas,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { cubeta: "Con saldo en" },
    defaultSort: { key: "saldo", dir: "desc" },
    searchAccessor: (r) => r.proveedor_nombre,
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
      proveedor: (a, b) => a.proveedor_nombre.localeCompare(b.proveedor_nombre),
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
    <PageContainer>
      <PageHeader
        icon={<LayoutList className="h-6 w-6 text-accent" />}
        title="Antigüedad de Saldos"
        description={`Saldos por proveedor agrupados por días de vencimiento (${monedaActiva}).`}
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
              onClick={() => exportarCxpAgingCsv(rowsFiltradas, monedaActiva, fecha)}
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
        idFecha="aging-cxp-corte"
      />

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
        searchPlaceholder="Buscar proveedor…"
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
          <DataTable<CxpAgingRow>
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            isError={!!aging.error}
            onRetry={() => void aging.refetch()}
            rowKey={(r) => r.proveedor_id}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            onRowClick={(r) => setDrilldown({ prov: r, cubeta: "todas" })}
            getRowAriaLabel={(r) => `Ver facturas con saldo de ${r.proveedor_nombre}`}
            emptyMessage="Sin saldos pendientes"
            emptyHint="No hay facturas de proveedor con saldo abierto."
            striped
            hoverable
            density={TABLE_DENSITY.embebida}
          />
        </CardContent>
      </Card>

      <AgingDrillDownDialog
        open={!!drilldown}
        onOpenChange={(o) => !o && setDrilldown(null)}
        proveedor={drilldown?.prov ?? null}
        cubetaInicial={drilldown?.cubeta ?? "todas"}
      />
    </PageContainer>
  );
}

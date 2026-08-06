/**
 * Página de Antigüedad de Saldos (aging) de CxC.
 * Ruta: `/cobranza/aging`. Tabla por cliente + 5 KPIs por cubeta.
 *
 * v13.313.1 (QW9 Tanda 3) — Nuevo reporte A/R con cubetas estándar.
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
import { CargaGuard } from "@/components/shared/states/CargaGuard";

import { buildCxcAgingColumns } from "@/features/cxc/components/cxcAgingColumns";
import { useCxcAging } from "@/features/cxc/hooks/useCxcAging";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { todayLocalISO } from "@/lib/date/today";
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import type { CubetaAging } from "@/features/cxp/components/agingBuckets";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

function KpiBucket({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warn" | "danger" }) {
  const toneCls =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning-foreground" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-semibold tabular-nums mt-1", toneCls)}>
          {formatCurrency(value, "MXN")}
        </p>
      </CardContent>
    </Card>
  );
}

function exportarCsv(rows: readonly CxcAgingRow[]) {
  const headers = ["Cliente", "Facturas", "Vigente", "1-30", "31-60", "61-90", ">90", "Total"];
  const lines = (rows ?? []).map((r) =>
    [
      `"${r.cliente_nombre.replace(/"/g, '""')}"`,
      r.num_facturas, r.vigente, r.d_1_30, r.d_31_60, r.d_61_90, r.mas_90, r.saldo_total,
    ].join(","),
  );
  downloadCsvWithFeedback({
    filename: `aging-cxc-${todayLocalISO()}.csv`,
    csv: [headers.join(","), ...lines].join("\n"),
    rowCount: rows?.length ?? 0,
    emptyWarning: { description: "No hay saldos de clientes para exportar con los filtros actuales." },
  });
}

interface Filters extends Record<string, string> { cubeta: string }
const DEFAULTS: Filters = { cubeta: "todas" };

export default function CxcAging() {
  const { data = [], isLoading, totales, isError, refetch } = useCxcAging();
  const columns = useMemo(() => buildCxcAgingColumns(), []);
  const [drilldown] = useState<{ cli: CxcAgingRow; cubeta: CubetaAging | "todas" } | null>(null);

  const paged = useClientPagedList<CxcAgingRow, Filters>({
    data,
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
    <PageContainer>
      <PageHeader
        icon={<LayoutList className="h-6 w-6 text-accent" />}
        title="Antigüedad de Saldos"
        description="Saldos por cliente agrupados por días de vencimiento (MXN)."
        actions={
          <Button variant="outline" size="sm" onClick={() => exportarCsv(data)} disabled={data.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        }
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar la antigüedad de saldos"
        errorDescription="Ocurrió un error al obtener los saldos de clientes. Intenta de nuevo."
      >
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KpiBucket label="Vigente" value={totales.vigente} />
        <KpiBucket label="1-30 días" value={totales.d_1_30} tone={totales.d_1_30 > 0 ? "warn" : "default"} />
        <KpiBucket label="31-60 días" value={totales.d_31_60} tone={totales.d_31_60 > 0 ? "warn" : "default"} />
        <KpiBucket label="61-90 días" value={totales.d_61_90} tone={totales.d_61_90 > 0 ? "danger" : "default"} />
        <KpiBucket label=">90 días" value={totales.mas_90} tone={totales.mas_90 > 0 ? "danger" : "default"} />
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
              <SelectItem value="mas_90">&gt;90 días</SelectItem>
            </SelectContent>
          </Select>
        }
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      <Card>
        <CardContent className="p-0">
          <DataTable<CxcAgingRow>
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            rowKey={(r) => r.cliente_id}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            getRowHref={(r) => `/cartera?cliente=${r.cliente_id}`}
            getRowAriaLabel={(r) => `Ver cartera de ${r.cliente_nombre}`}
            emptyMessage="Sin saldos pendientes"
            emptyHint="No hay facturas con saldo abierto."
            striped
            hoverable
            density={TABLE_DENSITY.embebida}
          />
        </CardContent>
      </Card>

      {drilldown && null}
      </CargaGuard>
    </PageContainer>
  );
}

/**
 * Cartera — facturas emitidas con saldo pendiente.
 *
 * v13.173.0 (Ola 1 · Filtros globales): migrada al primitivo unificado
 * `useClientPagedList` — search, filtros (moneda / vencidas), rango de fechas
 * de vencimiento, orden y paginación sincronizados con la URL vía `nuqs`, y
 * barra `<UnifiedFiltersBar />` compartida con Facturación/Embarques.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Inbox } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";
import { resumirCartera } from "@/features/bandejas/domain/aggregates";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";

import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { buildCarteraColumns, type CarteraRow } from "./_sections/carteraColumns";
import { CarteraMobileList } from "./_sections/CarteraMobileList";

interface CarteraFilters extends Record<string, string> {
  moneda: string;
  vencidas: string; // "todas" | "si" | "no"
}

const DEFAULTS: CarteraFilters = { moneda: "todas", vencidas: "todas" };


export default function Cartera() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useCarteraPendiente();
  const { totalSaldo, vencidas, vencidoSaldo } = resumirCartera(data);

  const monedas = useMemo(
    () => Array.from(new Set(data.map((r) => r.moneda).filter(Boolean))).sort(),
    [data],
  );

  const paged = useClientPagedList<CarteraRow, CarteraFilters>({
    data,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { moneda: "Moneda", vencidas: "Vencidas" },
    defaultSort: { key: "dias", dir: "desc" },
    searchAccessor: (r) =>
      `${r.numero ?? ""} ${r.cliente_nombre ?? ""} ${r.expediente ?? ""}`,
    filterPredicate: (r, ff) => {
      if (ff.moneda !== "todas" && r.moneda !== ff.moneda) return false;
      if (ff.vencidas === "si" && r.dias_vencido <= 0) return false;
      if (ff.vencidas === "no" && r.dias_vencido > 0) return false;
      return true;
    },
    dateAccessor: (r) => r.fecha_vencimiento,
    sorters: {
      numero: (a, b) => (a.numero ?? "").localeCompare(b.numero ?? ""),
      cliente: (a, b) => (a.cliente_nombre ?? "").localeCompare(b.cliente_nombre ?? ""),
      vencimiento: (a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""),
      dias: (a, b) => a.dias_vencido - b.dias_vencido,
      total: (a, b) => Number(a.total) - Number(b.total),
      saldo: (a, b) => Number(a.saldo) - Number(b.saldo),
    },
  });

  const columns = useMemo(() => buildCarteraColumns(), []);

  return (
    <PageContainer>
      <PageHeader
        title="Cartera"
        description="Facturas emitidas con saldo pendiente. Da seguimiento a cobranza, registra promesas y cobros."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas con saldo</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totalSaldo, "MXN")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencido ({vencidas})</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{formatCurrency(vencidoSaldo, "MXN")}</CardContent>
        </Card>
      </div>

      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar folio, cliente o expediente…"
        primary={
          <>
            <Select value={paged.filters.vencidas} onValueChange={(v) => paged.setFilter("vencidas", v)}>
              <SelectTrigger className="w-[160px]" aria-label="Vencidas">
                <SelectValue placeholder="Vencidas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="si">Solo vencidas</SelectItem>
                <SelectItem value="no">No vencidas</SelectItem>
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
              <Label htmlFor="cartera-from">Vencimiento desde</Label>
              <Input
                id="cartera-from"
                type="date"
                value={paged.dateFrom}
                onChange={(e) => paged.setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartera-to">Vencimiento hasta</Label>
              <Input
                id="cartera-to"
                type="date"
                value={paged.dateTo}
                onChange={(e) => paged.setDateTo(e.target.value)}
              />
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
          <DataTable<CarteraRow>
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
    </PageContainer>
  );
}

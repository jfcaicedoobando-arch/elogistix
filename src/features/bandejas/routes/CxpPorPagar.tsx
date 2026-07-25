/**
 * CxP Por Pagar — facturas de proveedor vigentes con saldo.
 *
 * v13.173.0 (Ola 1 · Filtros globales) — migrada a `useClientPagedList` +
 * `<UnifiedFiltersBar />` con search, filtro de moneda, filtro de vencidas,
 * rango de fecha de vencimiento, orden y paginación sincronizados con la URL.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, CalendarCheck } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { resumirCxpPorPagar } from "@/features/bandejas/domain/aggregates";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { buildCxpPorPagarColumns, type CxpRow } from "./_sections/cxpPorPagarColumns";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { useProgramarPagoLote } from "@/features/cxp/hooks/useProgramarPagoLote";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { todayLocalISO } from "@/lib/date/today";


interface Filters extends Record<string, string> {
  moneda: string;
  vencidas: string;
}
const DEFAULTS: Filters = { moneda: "todas", vencidas: "todas" };

export default function CxpPorPagar() {
  const { data = [], isLoading } = useCxpPorPagar();
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumirCxpPorPagar(data);
  const [rowSelection, setRowSelection] = useState({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fechaProgramada, setFechaProgramada] = useState(todayLocalISO());
  const { programar, isRunning, progreso } = useProgramarPagoLote();

  const monedas = useMemo(
    () => Array.from(new Set(data.map((r) => r.moneda).filter(Boolean))).sort(),
    [data],
  );

  const paged = useClientPagedList<CxpRow, Filters>({
    data,
    isLoading,
    defaultFilters: DEFAULTS,
    filterLabels: { moneda: "Moneda", vencidas: "Vencidas" },
    defaultSort: { key: "dias", dir: "asc" },
    searchAccessor: (r) =>
      `${r.proveedor_nombre ?? ""} ${r.folio_proveedor ?? ""} ${r.expediente ?? ""}`,
    filterPredicate: (r, ff) => {
      if (ff.moneda !== "todas" && r.moneda !== ff.moneda) return false;
      const dias = r.dias_para_vencer ?? 0;
      if (ff.vencidas === "si" && dias >= 0) return false;
      if (ff.vencidas === "no" && dias < 0) return false;
      return true;
    },
    dateAccessor: (r) => r.fecha_vencimiento,
    sorters: {
      proveedor: (a, b) => (a.proveedor_nombre ?? "").localeCompare(b.proveedor_nombre ?? ""),
      folio: (a, b) => (a.folio_proveedor ?? "").localeCompare(b.folio_proveedor ?? ""),
      vencimiento: (a, b) => (a.fecha_vencimiento ?? "").localeCompare(b.fecha_vencimiento ?? ""),
      dias: (a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0),
      total: (a, b) => Number(a.total) - Number(b.total),
      pagado: (a, b) => Number(a.pagado) - Number(b.pagado),
      saldo: (a, b) => Number(a.saldo) - Number(b.saldo),
    },
  });

  const columns = useMemo(() => buildCxpPorPagarColumns(), []);

  const selectedIds = useMemo(() => Object.keys(rowSelection), [rowSelection]);
  const hasSelection = selectedIds.length > 0;

  const handleProgramar = async () => {
    await programar(selectedIds, fechaProgramada);
    setIsDialogOpen(false);
    setRowSelection({});
  };

  return (
    <PageContainer>
      <PageHeader
        title="CxP — Por pagar"
        description="Facturas de proveedor vigentes con saldo. Programa y registra los pagos."
        actions={
          hasSelection && (
            <Button onClick={() => setIsDialogOpen(true)} variant="default">
              <CalendarCheck className="h-4 w-4 mr-2" />
              Programar pago ({selectedIds.length})
            </Button>
          )
        }
      />



      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas vigentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(saldoMXN, "MXN")}</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-label text-muted-foreground mt-1">
              {porMoneda.MXN > 0 && <span>{formatCurrencyCompact(porMoneda.MXN, "MXN")}</span>}
              {porMoneda.USD > 0 && <span>· {formatCurrencyCompact(porMoneda.USD, "USD")}</span>}
              {porMoneda.EUR > 0 && <span>· {formatCurrencyCompact(porMoneda.EUR, "EUR")}</span>}
            </div>
            {faltaTipoCambio > 0 && (
              <p className="text-2xs text-warning mt-0.5">
                {faltaTipoCambio} factura{faltaTipoCambio > 1 ? "s" : ""} sin TC capturado — no incluida{faltaTipoCambio > 1 ? "s" : ""} en homologado.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{vencidas}</CardContent>
        </Card>
      </div>

      <UnifiedFiltersBar
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar proveedor, folio o expediente…"
        primary={
          <>
            <Select value={paged.filters.vencidas} onValueChange={(v) => paged.setFilter("vencidas", v)}>
              <SelectTrigger className="w-[160px]" aria-label="Vencidas">
                <SelectValue placeholder="Vencidas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="si">Solo vencidas</SelectItem>
                <SelectItem value="no">Vigentes</SelectItem>
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
              <Label htmlFor="cxp-from">Vencimiento desde</Label>
              <DatePickerMx value={paged.dateFrom} onChange={paged.setDateFrom} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cxp-to">Vencimiento hasta</Label>
              <DatePickerMx value={paged.dateTo} onChange={paged.setDateTo} />
            </div>
          </div>
        }
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
      />

      <Card>
        <CardContent className="p-0">
          <DataTable<CxpRow>
            columns={columns}
            data={paged.rows}
            rowKey={(r) => r.factura_id}
            isLoading={paged.isLoading}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            getRowHref={(r) => `/cxp?factura=${r.factura_id}`}
            getRowAriaLabel={(r) => `Factura ${r.folio_proveedor ?? ""} de ${r.proveedor_nombre ?? ""}`}
            emptyIcon={Inbox}
            emptyMessage="Sin facturas pendientes de pago"
            emptyHint="Cuando ingreses una factura de proveedor, aparecerá aquí."
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            enableRowSelection
          />
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Programar pago</DialogTitle>
            <DialogDescription>
              Selecciona la fecha en la que Tesorería deberá ejecutar el pago para las {selectedIds.length} facturas seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Fecha de pago</Label>
              <DatePickerMx
                value={fechaProgramada}
                onChange={(v) => v && setFechaProgramada(v)}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isRunning}>
              Cancelar
            </Button>
            <Button onClick={handleProgramar} disabled={isRunning || !fechaProgramada}>
              {isRunning ? `Programando (${progreso?.hecho}/${progreso?.total})...` : "Confirmar programación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

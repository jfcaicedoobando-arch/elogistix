/**
 * Bandeja "Por facturar" (hueco de facturación): embarques cerrados sin CFDI.
 * Estados unificados vía `<BandejaShell />`.
 */
import { Download, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { huecoFacturacionColumns } from "@/features/facturacion/components/huecoFacturacionColumns";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import type { FilaHueco } from "@/features/facturacion/services";
import { BandejaShell } from "./BandejaShell";

export function BandejaPorFacturar() {
  const { filas, isLoading, isError, refetch, totalEmbarques, totalUsd, totalMxn, exportarCsv } =
    useHuecoFacturacion();

  const paged = useClientPagedList<FilaHueco, Record<string, string>>({
    data: filas,
    isLoading,
    defaultFilters: {},
    defaultSort: { key: "dias", dir: "desc" },
    searchAccessor: (r) =>
      `${r.expediente ?? ""} ${r.cliente_nombre ?? ""} ${r.operador ?? ""} ${r.bl_master ?? ""} ${r.bl_house ?? ""}`,
    sorters: {
      expediente: (a, b) => (a.expediente ?? "").localeCompare(b.expediente ?? ""),
      cliente: (a, b) => (a.cliente_nombre ?? "").localeCompare(b.cliente_nombre ?? ""),
      operador: (a, b) => (a.operador ?? "").localeCompare(b.operador ?? ""),
      eta: (a, b) => (a.eta ?? "").localeCompare(b.eta ?? ""),
      bl: (a, b) => (a.bl_master ?? a.bl_house ?? "").localeCompare(b.bl_master ?? b.bl_house ?? ""),
      dias: (a, b) => a.diasDesdeEta - b.diasDesdeEta,
      venta_usd: (a, b) => a.ventaUsd - b.ventaUsd,
      venta_mxn: (a, b) => a.ventaMxn - b.ventaMxn,
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{totalEmbarques}</span>{" "}
          embarque(s) sin CFDI (ETA vencida o dentro de 3 días) ·{" "}
          <span className="tabular-nums">{formatCurrency(totalUsd, "USD")}</span> ·{" "}
          <span className="tabular-nums">{formatCurrency(totalMxn, "MXN")}</span>
        </div>

        <Button size="sm" variant="outline" onClick={exportarCsv} disabled={filas.length === 0 || isError}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      <BandejaShell
        isError={isError}
        onRetry={() => refetch()}
        search={paged.search}
        onSearchChange={paged.setSearch}
        searchPlaceholder="Buscar expediente, cliente, operador o BL…"
        chips={paged.activeChips}
        activeCount={paged.activeCount}
        onClearAll={paged.resetAll}
        counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalEmbarques} embarques</>}
      >
        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={huecoFacturacionColumns}
              data={paged.rows}
              isLoading={paged.isLoading}
              emptyIcon={PackageCheck}
              emptyMessage="Sin embarques listos por facturar — no hay hueco de facturación."
              emptyHint="Aquí aparecerán los embarques por llegar (o ya llegados) que todavía no tienen una factura emitida."

              rowKey={(row) => row.embarque_id}
              getRowHref={(row) => `/embarques/${row.embarque_id}?tab=facturacion`}
              getRowAriaLabel={(row) => `Abrir embarque ${row.expediente ?? row.embarque_id}`}
              sortMode="server"
              controlledSort={paged.controlledSort}
              onSortChange={paged.setSort}
              pagination={paged.pagination}
            />
          </CardContent>
        </Card>
      </BandejaShell>
    </div>
  );
}

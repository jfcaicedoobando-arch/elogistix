/**
 * Bandeja "Por facturar" (hueco de facturación): embarques cerrados sin CFDI.
 * Estados unificados vía `<BandejaShell />`.
 */
import { Download, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { huecoFacturacionColumns } from "@/features/facturacion/components/huecoFacturacionColumns";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import type { FilaHueco } from "@/features/facturacion/services";
import { BandejaShell } from "./BandejaShell";
import { getDiasVencidosTone } from "@/lib/ui/uiMappings";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
        <div className="text-body text-muted-foreground">
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
            <ResponsiveDataTable
              columns={huecoFacturacionColumns}
              data={paged.rows}
              isLoading={paged.isLoading}
              emptyState={
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-body text-muted-foreground px-4">
                  <PackageCheck className="h-8 w-8 opacity-40" strokeWidth={1.5} />
                  <span>Sin embarques listos por facturar — no hay hueco de facturación.</span>
                </div>
              }
              rowKey={(row) => row.embarque_id}
              getRowHref={(row) => `/embarques/${row.embarque_id}?tab=facturacion`}
              getRowAriaLabel={(row) => `Abrir embarque ${row.expediente ?? row.embarque_id}`}
              sortMode="server"
              controlledSort={paged.controlledSort}
              onSortChange={paged.setSort}
              pagination={paged.pagination}
              mobileCard={(row) => {
                const d = row.diasDesdeEta;
                const label = d < 0 ? `faltan ${Math.abs(d)} d` : `${d} d`;
                const tone = getDiasVencidosTone(d);
                return (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-body truncate font-mono">{row.expediente || "—"}</div>
                      <div className="text-body-sm text-muted-foreground truncate mt-0.5">{toTitleCase(row.cliente_nombre)}</div>
                      <div className="text-label text-muted-foreground mt-0.5">
                        ETA {formatDate(row.eta)} · {formatCurrency(row.ventaUsd, "USD")}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "tabular-nums font-semibold whitespace-nowrap",
                        tone === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
                        tone === "warning" && "bg-warning/10 text-warning border-warning/30",
                        tone === "default" && "bg-muted text-foreground",
                      )}
                    >
                      {label}
                    </Badge>
                  </div>
                );
              }}
            />
          </CardContent>
        </Card>
      </BandejaShell>
    </div>
  );
}

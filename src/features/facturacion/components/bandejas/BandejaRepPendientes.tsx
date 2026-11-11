/**
 * Bandeja "REP pendientes": pagos aplicados a facturas PPD cuyo REP no se
 * ha timbrado. Estados unificados vía `<BandejaShell />`.
 * v13.491.0 — timbrado desde la propia bandeja: botón por renglón y selección
 * múltiple para timbrar varios REP en una sola pasada.
 */
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReceiptText } from "lucide-react";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgFilter } from "@/hooks/shared";
import { useRowSelection } from "@/components/shared/dataTable/useRowSelection";
import { buildSelectionColumn } from "@/components/shared/dataTable/buildSelectionColumn";
import { usePagosRepPendientes, type FilaRepPendiente } from "@/features/facturacion/hooks/useBandejas";
import { useTimbrarRepsLote } from "@/features/facturacion/hooks/useTimbrarRepsLote";
import { BandejaShell } from "./BandejaShell";
import { BandejaRepAcciones } from "./BandejaRepAcciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { ReceiptText as ReceiptIcon } from "lucide-react";
import { buildRepPendientesColumns } from "./bandejaRepColumns";

export function BandejaRepPendientes() {
  const { organizationId } = useOrgFilter();
  return <BandejaRepPendientesContenido key={organizationId} organizationId={organizationId} />;
}

function BandejaRepPendientesContenido({ organizationId }: { organizationId: string | null }) {
  const paged = usePagosRepPendientes(organizationId);
  const selection = useRowSelection();
  const { timbrar, enProceso, progreso } = useTimbrarRepsLote();
  const [pagoEnProceso, setPagoEnProceso] = useState<string | null>(null);

  const timbrarUno = useCallback(async (pagoId: string) => {
    setPagoEnProceso(pagoId);
    try {
      await timbrar([pagoId]);
    } finally {
      setPagoEnProceso(null);
    }
  }, [timbrar]);

  const timbrarSeleccion = async () => {
    const ids = [...selection.selectedIds];
    if (ids.length === 0 || paged.isStaleView) return;
    await timbrar(ids);
    selection.clear();
  };

  const columns = useMemo(
    () => [
      buildSelectionColumn<FilaRepPendiente>(),
      ...buildRepPendientesColumns({
        onTimbrar: (id) => void timbrarUno(id),
        pagoEnProceso,
        bloqueado: enProceso,
      }),
    ],
    [pagoEnProceso, enProceso, timbrarUno],
  );

  return (
    <BandejaShell
      isError={Boolean(paged.error)}
      onRetry={() => paged.refetch()}
      search={paged.search}
      onSearchChange={paged.setSearch}
      searchPlaceholder="Buscar factura o cliente…"
      chips={paged.activeChips}
      activeCount={paged.activeCount}
      onClearAll={paged.resetAll}
      primary={
        <Select value={paged.filters.estado} onValueChange={(v) => paged.setFilter("estado", v)}>
          <SelectTrigger className="w-[160px]" aria-label="Estado REP">
            <SelectValue placeholder="Estado REP" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="Pendiente">Pendiente</SelectItem>
            <SelectItem value="Error">Error</SelectItem>
          </SelectContent>
        </Select>
      }
      counter={paged.isStaleView ? "Actualizando…" : !paged.isLoading && !paged.error && (
        <>Mostrando <strong className="text-foreground">{paged.rows.length}</strong> de {paged.count} complementos pendientes</>
      )}
    >
      <BandejaRepAcciones
        seleccionados={selection.selectedCount}
        enProceso={enProceso}
        deshabilitado={paged.isStaleView}
        progreso={progreso}
        onTimbrar={() => void timbrarSeleccion()}
        onLimpiar={selection.clear}
      />
      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={paged.isStaleView ? [] : paged.rows}
            isLoading={paged.isLoading || paged.isStaleView}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-body text-muted-foreground px-4">
                <ReceiptText className="h-8 w-8 opacity-40" strokeWidth={1.5} />
                <span>Sin complementos de pago (REP) pendientes ante el SAT.</span>
              </div>
            }
            rowKey={(r) => r.id}
            getRowHref={(r) => `/facturacion/${r.factura_id}`}
            getRowAriaLabel={(r) => `Abrir factura ${r.factura_numero}`}
            rowSelection={selection.rowSelection}
            onRowSelectionChange={selection.onRowSelectionChange}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={(key, dir) => { paged.setPage(0); paged.setSort(key, dir); }}
            pagination={paged.pagination}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-body truncate font-mono">{r.factura_numero}</div>
                  <div className="text-body-sm text-muted-foreground truncate mt-0.5">{toTitleCase(r.cliente_nombre)}</div>
                  <div className="text-label text-muted-foreground mt-0.5">
                    {formatDate(r.fecha_pago)} · {formatCurrency(r.monto, r.moneda)}
                  </div>
                  <Badge variant={r.estado_rep === "Error" ? "destructive" : "outline"} className="mt-1">{r.estado_rep}</Badge>
                </div>
                <div data-no-row-nav onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={enProceso}
                    loading={pagoEnProceso === r.id}
                    onClick={() => void timbrarUno(r.id)}
                    aria-label={`Timbrar REP de la factura ${r.factura_numero}`}
                  >
                    {pagoEnProceso !== r.id && <ReceiptIcon className="mr-2 h-3.5 w-3.5" />}
                    Timbrar
                  </Button>
                </div>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </BandejaShell>
  );
}

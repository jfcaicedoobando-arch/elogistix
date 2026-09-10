/**
 * Bandeja "REPs" (grupo Histórico): complementos de pago (REP) ya timbrados
 * ante el SAT. Espejo de sólo lectura de "REP pendientes": consulta con
 * buscador y descarga de PDF/XML; sin acciones de timbrado ni cancelación.
 */
import { useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck2, FileDown, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";
import { useRepsHistorico, type FilaRepHistorico } from "@/features/facturacion/hooks/useBandejas";
import { descargarCfdiFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";
import { useConsultarRep } from "@/features/facturacion/hooks/useConsultarRep";

import { notifyError } from "@/lib/ui/appFeedback";
import { BandejaShell } from "./BandejaShell";
import { buildRepsHistoricoColumns, estadoRepHistorico } from "./bandejaRepsHistoricoColumns";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";

export function BandejaRepsHistorico() {
  const { data, isLoading, isError, refetch } = useRepsHistorico();
  const consultar = useConsultarRep();
  const [descargando, setDescargando] = useState<string | null>(null);


  const descargar = useCallback(async (pagoId: string, tipo: "pdf" | "xml") => {
    setDescargando(`${pagoId}:${tipo}`);
    try {
      await descargarCfdiFacturapi({ tipo, pagoId });
    } catch (err) {
      // UIA-13: el detalle técnico va al log/Sentry; al usuario se le dice qué hacer.
      notifyError(undefined, {
        title: tipo === "pdf" ? "No se pudo descargar el PDF" : "No se pudo descargar el XML",
        description: "Revisa tu conexión a internet e inténtalo de nuevo. Si continúa, avisa a soporte.",
        error: err,
        method: "FEATURES_FACTURACION_COMPONENTS_BANDEJAREPSHISTORICO_1",
      });
    } finally {
      setDescargando(null);
    }
  }, []);

  const columns = useMemo(
    () => buildRepsHistoricoColumns({
      onDescargar: (id, tipo) => void descargar(id, tipo),
      descargando,
      onActualizarSat: (id) => consultar.mutate(id),
      actualizando: consultar.isPending ? consultar.variables ?? null : null,
    }),
    [descargar, descargando, consultar],
  );


  const paged = useClientPagedList<FilaRepHistorico>({
    data,
    isLoading,
    defaultFilters: {},
    defaultSort: { key: "timbrado", dir: "desc" },
    searchAccessor: (r) => `${r.folio_rep} ${r.factura_numero} ${r.cliente_nombre} ${r.uuid_rep ?? ""}`,
    sorters: {
      folio_rep: (a, b) => a.folio_rep.localeCompare(b.folio_rep),
      factura: (a, b) => a.factura_numero.localeCompare(b.factura_numero),
      cliente: (a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre),
      fecha_pago: (a, b) => a.fecha_pago.localeCompare(b.fecha_pago),
      monto: (a, b) => a.monto - b.monto,
      timbrado: (a, b) => (a.timbrado_rep_en ?? "").localeCompare(b.timbrado_rep_en ?? ""),
      estado: (a, b) => estadoRepHistorico(a).localeCompare(estadoRepHistorico(b)),
    },
  });
  const totalCount = data?.length ?? 0;

  return (
    <BandejaShell
      isError={isError}
      onRetry={() => refetch()}
      search={paged.search}
      onSearchChange={paged.setSearch}
      searchPlaceholder="Buscar por folio, factura, cliente o UUID…"
      chips={paged.activeChips}
      activeCount={paged.activeCount}
      onClearAll={paged.resetAll}
      counter={<>Mostrando <strong className="text-foreground">{paged.filteredCount}</strong> de {totalCount} REPs timbrados</>}
    >
      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={paged.rows}
            isLoading={paged.isLoading}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-body text-muted-foreground px-4">
                <FileCheck2 className="h-8 w-8 opacity-40" strokeWidth={1.5} />
                <span>Aún no hay complementos de pago (REP) timbrados.</span>
              </div>
            }
            rowKey={(r) => r.id}
            getRowHref={(r) => `/facturacion/${r.factura_id}`}
            getRowAriaLabel={(r) => `Abrir factura ${r.factura_numero}`}
            sortMode="server"
            controlledSort={paged.controlledSort}
            onSortChange={paged.setSort}
            pagination={paged.pagination}
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-body truncate font-mono">{r.folio_rep}</div>
                  <div className="text-body-sm text-muted-foreground truncate mt-0.5">
                    {r.factura_numero} · {toTitleCase(r.cliente_nombre)}
                  </div>
                  <div className="text-label text-muted-foreground mt-0.5">
                    {formatDate(r.fecha_pago)} · {formatCurrency(r.monto, r.moneda)}
                  </div>
                  <Badge
                    variant={estadoRepHistorico(r) === "Cancelado" ? "destructive" : "outline"}
                    className="mt-1"
                  >
                    {estadoRepHistorico(r)}
                  </Badge>
                </div>
                <div data-no-row-nav onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1">
                  <Button
                    size="icon" variant="outline" className="min-h-11 min-w-11"
                    loading={descargando === `${r.id}:pdf`}
                    onClick={() => void descargar(r.id, "pdf")}
                    aria-label={`Descargar PDF del REP ${r.folio_rep}`}
                  >
                    <FileDown className="size-4" />
                  </Button>
                  <Button
                    size="icon" variant="outline" className="min-h-11 min-w-11"
                    loading={descargando === `${r.id}:xml`}
                    onClick={() => void descargar(r.id, "xml")}
                    aria-label={`Descargar XML del REP ${r.folio_rep}`}
                  >
                    <FileCode className="size-4" />
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

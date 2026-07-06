/**
 * Bandeja /compras/por-aprobar — Ola C.
 *
 * Lista dedicada de facturas de proveedor bajo flujo de aprobación
 * (estados: pendiente / aprobada / rechazada). Reutiliza el fetch de CxP
 * filtrando por `aprobacion`, y abre el detalle en `DialogDetallePagosProveedor`
 * donde ya vive el `BotonesAprobacionFactura` para aprobar/rechazar.
 */
import { useMemo, useState } from "react";
import { ShieldCheck, Inbox, ClipboardCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useAprobarFacturasLote } from "@/features/cxp/hooks/useAprobarFacturasLote";
import { buildCxPColumns } from "@/features/cxp/components/cxpColumns";
import { DialogDetallePagosProveedor } from "@/features/cxp/components/DialogDetallePagosProveedor";
import type { FacturaCxP } from "@/features/cxp/services";
import { KPICard, sumaMxn, sumaUsd } from "./ComprasPorAprobar.kpi";
import { buildSelectionColumn } from "./ComprasPorAprobar.selectionCol";
import { ConfirmarAprobacionLoteDialog } from "./ComprasPorAprobar.confirmDialog";

type AprobacionFiltro = "pendiente" | "aprobada" | "rechazada";

export default function ComprasPorAprobar() {
  const { canEdit } = usePermissions();
  const [aprobacion, setAprobacion] = useState<AprobacionFiltro>("pendiente");
  const [search, setSearch] = useState("");
  const [detalle, setDetalle] = useState<FacturaCxP | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { aprobar, isRunning, progreso } = useAprobarFacturasLote();

  const { data: rows = [], isLoading } = useFacturasCxP({
    aprobacion,
    search: search || undefined,
  });

  // Contadores globales por estado (sin filtro de búsqueda) para los tabs/KPIs.
  const { data: pendientes = [] } = useFacturasCxP({ aprobacion: "pendiente" });
  const { data: aprobadas = [] } = useFacturasCxP({ aprobacion: "aprobada" });
  const { data: rechazadas = [] } = useFacturasCxP({ aprobacion: "rechazada" });

  const seleccionEnLote = canEdit && aprobacion === "pendiente";

  const columns = useMemo(() => {
    const base = buildCxPColumns();
    if (!seleccionEnLote) return base;
    return [buildSelectionColumn({ rows, selected, setSelected }), ...base];
  }, [rows, selected, seleccionEnLote]);

  const currentTotalMxn = useMemo(() => sumaMxn(rows), [rows]);
  const currentTotalUsd = useMemo(() => sumaUsd(rows), [rows]);

  const seleccionadas = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const totalSelMxn = sumaMxn(seleccionadas);
  const totalSelUsd = sumaUsd(seleccionadas);

  const handleAprobarLote = async () => {
    await aprobar(Array.from(selected));
    setSelected(new Set());
    setConfirmOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-accent" />}
        title="Por aprobar"
        description="Solicitudes de aprobación de facturas de proveedor. Revisa, aprueba o rechaza cada solicitud."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={ClipboardCheck}
          label="Pendientes"
          count={pendientes.length}
          monto={`${formatCurrency(sumaMxn(pendientes), "MXN")} · ${formatCurrency(sumaUsd(pendientes), "USD")}`}
          tone="warn"
        />
        <KPICard icon={CheckCircle2} label="Aprobadas" count={aprobadas.length} tone="success" />
        <KPICard icon={XCircle} label="Rechazadas" count={rechazadas.length} tone="danger" />
        <KPICard
          icon={ClipboardCheck}
          label={`Total en vista (${aprobacion})`}
          count={rows.length}
          monto={`${formatCurrency(currentTotalMxn, "MXN")} · ${formatCurrency(currentTotalUsd, "USD")}`}
        />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Tabs
            value={aprobacion}
            onValueChange={(v) => {
              setAprobacion(v as AprobacionFiltro);
              setSelected(new Set());
            }}
          >
            <TabsList>
              <TabsTrigger value="pendiente">
                Pendientes <span className="ml-1.5 text-2xs opacity-70">({pendientes.length})</span>
              </TabsTrigger>
              <TabsTrigger value="aprobada">
                Aprobadas <span className="ml-1.5 text-2xs opacity-70">({aprobadas.length})</span>
              </TabsTrigger>
              <TabsTrigger value="rechazada">
                Rechazadas <span className="ml-1.5 text-2xs opacity-70">({rechazadas.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por folio, folio proveedor o proveedor…"
          />
          {seleccionEnLote && (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
                selected.size > 0 ? "bg-accent/5 border-accent/40" : "bg-muted/30",
              )}
            >
              <p className="text-xs text-muted-foreground">
                {selected.size === 0
                  ? "Selecciona una o más facturas para aprobarlas en lote."
                  : `${selected.size} factura(s) seleccionada(s) · ${formatCurrency(totalSelMxn, "MXN")} · ${formatCurrency(totalSelUsd, "USD")}`}
                {isRunning && progreso && (
                  <span className="ml-2 text-accent">
                    Procesando {progreso.hecho}/{progreso.total}…
                  </span>
                )}
              </p>
              <Button size="sm" disabled={selected.size === 0 || isRunning} onClick={() => setConfirmOpen(true)}>
                {isRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Aprobar seleccionadas ({selected.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!isLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-base font-semibold">
                {aprobacion === "pendiente"
                  ? "No hay solicitudes pendientes"
                  : aprobacion === "aprobada"
                  ? "No hay facturas aprobadas"
                  : "No hay facturas rechazadas"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {aprobacion === "pendiente"
                  ? "Todas las facturas capturadas están al día. Cuando llegue una nueva solicitud aparecerá aquí."
                  : "Cambia de pestaña o ajusta la búsqueda para ver otros estados."}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              isLoading={isLoading}
              emptyMessage="No hay facturas que coincidan con la búsqueda"
              rowKey={(f) => f.id}
              density="compact"
              initialSort={{ key: "vencimiento", dir: "asc" }}
              onRowClick={(fact) => setDetalle(fact)}
            />
          )}
        </CardContent>
      </Card>

      <DialogDetallePagosProveedor
        open={!!detalle}
        onOpenChange={(o) => !o && setDetalle(null)}
        factura={detalle ? rows.find((r) => r.id === detalle.id) ?? detalle : null}
        canEdit={canEdit}
      />

      <ConfirmarAprobacionLoteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        cantidad={selected.size}
        totalMxn={totalSelMxn}
        totalUsd={totalSelUsd}
        isRunning={isRunning}
        onConfirm={() => void handleAprobarLote()}
      />
    </PageContainer>
  );
}

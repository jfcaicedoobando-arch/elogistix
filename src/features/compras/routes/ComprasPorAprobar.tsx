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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import SearchInput from "@/components/shared/SearchInput";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/shared";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useAprobarFacturasLote } from "@/features/cxp/hooks/useAprobarFacturasLote";
import { buildCxPColumns } from "@/features/cxp/components/cxpColumns";
import { DialogDetallePagosProveedor } from "@/features/cxp/components/DialogDetallePagosProveedor";
import type { FacturaCxP } from "@/features/cxp/services";

type AprobacionFiltro = "pendiente" | "aprobada" | "rechazada";

function KPICard({
  icon: Icon, label, count, monto, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  monto?: string;
  tone?: "default" | "warn" | "success" | "danger";
}) {
  const toneCls =
    tone === "danger" ? "text-destructive"
    : tone === "success" ? "text-success"
    : tone === "warn" ? "text-warning"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", toneCls)} />
          <span>{label}</span>
        </p>
        <p className={cn("text-lg font-semibold tabular-nums", toneCls)}>
          {count} <span className="text-xs font-normal text-muted-foreground">
            {count === 1 ? "factura" : "facturas"}
          </span>
        </p>
        {monto && <p className="text-xs text-muted-foreground tabular-nums">{monto}</p>}
      </CardContent>
    </Card>
  );
}

function sumaMxn(rows: FacturaCxP[]): number {
  return rows
    .filter((f) => f.moneda === "MXN")
    .reduce((acc, f) => acc + Number(f.total ?? 0), 0);
}
function sumaUsd(rows: FacturaCxP[]): number {
  return rows
    .filter((f) => f.moneda === "USD")
    .reduce((acc, f) => acc + Number(f.total ?? 0), 0);
}

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

  // Columna de selección solo en modo pendiente.
  const columns = useMemo(() => {
    const base = buildCxPColumns();
    if (!seleccionEnLote) return base;
    const selectionCol = defineColumns<FacturaCxP>([
      {
        id: "sel",
        header: () => {
          const allIds = rows.map((r) => r.id);
          const allSel = allIds.length > 0 && allIds.every((id) => selected.has(id));
          const someSel = allIds.some((id) => selected.has(id));
          return (
            <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
              <Checkbox
                aria-label={allSel ? "Deseleccionar todas" : "Seleccionar todas"}
                checked={allSel ? true : someSel ? "indeterminate" : false}
                onCheckedChange={(v) => {
                  setSelected(() => (v ? new Set(allIds) : new Set()));
                }}
              />
            </div>
          );
        },
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
            <Checkbox
              aria-label={`Seleccionar factura ${row.original.folio_proveedor}`}
              checked={selected.has(row.original.id)}
              onCheckedChange={(v) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (v) next.add(row.original.id);
                  else next.delete(row.original.id);
                  return next;
                });
              }}
            />
          </div>
        ),
        meta: { align: "center" },
        size: 40,
      },
    ])[0];
    return [selectionCol, ...base];
  }, [rows, selected, seleccionEnLote]);

  const currentTotalMxn = useMemo(() => sumaMxn(rows), [rows]);
  const currentTotalUsd = useMemo(() => sumaUsd(rows), [rows]);

  const seleccionadas = useMemo(() => rows.filter((r) => selected.has(r.id)), [rows, selected]);
  const totalSelMxn = sumaMxn(seleccionadas);
  const totalSelUsd = sumaUsd(seleccionadas);

  const handleAprobarLote = async () => {
    const ids = Array.from(selected);
    await aprobar(ids);
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
        <KPICard
          icon={CheckCircle2}
          label="Aprobadas"
          count={aprobadas.length}
          tone="success"
        />
        <KPICard
          icon={XCircle}
          label="Rechazadas"
          count={rechazadas.length}
          tone="danger"
        />
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
              <Button
                size="sm"
                disabled={selected.size === 0 || isRunning}
                onClick={() => setConfirmOpen(true)}
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                )}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprobar {selected.size} factura(s) en lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Vas a aprobar <strong>{selected.size}</strong> solicitudes en un solo paso. El total involucrado es:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground text-xs space-y-0.5">
                  <li>MXN: {formatCurrency(totalSelMxn, "MXN")}</li>
                  <li>USD: {formatCurrency(totalSelUsd, "USD")}</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  El proceso corre factura por factura. Si alguna falla, te lo indicamos al final para revisarla manualmente.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRunning}
              onClick={(e) => {
                e.preventDefault();
                void handleAprobarLote();
              }}
            >
              {isRunning && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Aprobar {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

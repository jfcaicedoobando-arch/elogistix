/**
 * Panel lateral con el desglose cotizado vs real de un embarque, invocado
 * desde /compras/conciliacion. Evita sacar al usuario de la pantalla al
 * clickear una fila: reusa `fetchReconciliacionEmbarque` (Fase 2) y
 * `calcularResumen` para presentar la información en línea.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Link2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency } from "@/lib/formatters";
import {
  fetchReconciliacionEmbarque,
  calcularResumen,
  type FilaReconciliacion,
} from "@/features/embarques/services/reconciliacionCostos";
import type { EmbarqueConciliacion } from "@/features/compras/services/conciliacionEmbarques";
import { CONCILIACION_ESTADO_LABELS } from "./conciliacionColumns";

interface Props {
  embarque: EmbarqueConciliacion | null;
  onClose: () => void;
}

export function ConciliacionDetalleSheet({ embarque, onClose }: Props) {
  const navigate = useNavigate();
  const embarqueId = embarque?.embarque_id ?? null;

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["compras", "conciliacion-detalle", embarqueId],
    queryFn: () => fetchReconciliacionEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });

  const resumen = useMemo(() => calcularResumen(filas), [filas]);
  const columns = useMemo(() => buildDetalleColumns(navigate), [navigate]);

  const monedaResumen = embarque?.moneda ?? filas[0]?.moneda ?? "MXN";

  return (
    <Sheet open={Boolean(embarque)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        {embarque && (
          <>
            <SheetHeader className="space-y-2 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="font-mono text-base">{embarque.expediente}</SheetTitle>
                <EstadoConciliacionBadge estado={embarque.estado_conciliacion} />
                {embarque.estado && (
                  <Badge variant="outline" className="text-xs">{embarque.estado}</Badge>
                )}
                <Badge variant="secondary" className="text-xs">{embarque.moneda}</Badge>
              </div>
              <SheetDescription>
                {embarque.cliente_nombre ?? "Cliente sin nombre"}
              </SheetDescription>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/embarques/${embarque.embarque_id}`)}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir embarque
                </Button>
              </div>
            </SheetHeader>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <ResumenTile label="Cotizado" value={formatCurrency(resumen.total_cotizado, monedaResumen)} />
              <ResumenTile label="Real facturado" value={formatCurrency(resumen.total_real, monedaResumen)} />
              <ResumenTile
                label="Diferencia"
                value={formatCurrency(resumen.diferencia_total, monedaResumen)}
                tone={resumen.diferencia_total > 0 ? "destructive" : resumen.diferencia_total < 0 ? "success" : "muted"}
              />
              <ResumenTile
                label="Desviación %"
                value={`${resumen.desviacion_pct_total.toFixed(1)}%`}
                tone={resumen.desviacion_pct_total > 0 ? "destructive" : resumen.desviacion_pct_total < 0 ? "success" : "muted"}
              />
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Conceptos sin factura: <strong>{resumen.conceptos_sin_factura}</strong> de {filas.length}
            </div>

            <div className="mt-4">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : filas.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Sin conceptos de costo"
                  description="Este embarque no tiene conceptos de costo registrados para conciliar."
                />
              ) : (
                <DataTable
                  columns={columns}
                  data={filas}
                  rowKey={(f) => f.concepto_costo_id}
                  density="compact"
                />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EstadoConciliacionBadge({ estado }: { estado: EmbarqueConciliacion["estado_conciliacion"] }) {
  const meta = CONCILIACION_ESTADO_LABELS[estado];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

type Tone = "destructive" | "success" | "muted" | "default";
function ResumenTile({ label, value, tone = "default" }: { label: string; value: string; tone?: Tone }) {
  const toneClass =
    tone === "destructive" ? "text-destructive"
    : tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function buildDetalleColumns(navigate: (path: string) => void) {
  return defineColumns<FilaReconciliacion>([
    {
      id: "concepto",
      header: "Concepto",
      accessorFn: (r) => r.concepto,
      cell: ({ row }) => (
        <div className="min-w-[140px]">
          <div className="text-xs font-medium">{row.original.concepto}</div>
          <div className="text-[10px] text-muted-foreground">{row.original.proveedor_nombre || "—"}</div>
        </div>
      ),
    },
    {
      id: "cotizado",
      header: "Cotizado",
      accessorFn: (r) => r.cotizado,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatCurrency(row.original.cotizado, row.original.moneda)}
        </span>
      ),
    },
    {
      id: "real",
      header: "Real",
      accessorFn: (r) => r.real_facturado,
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatCurrency(row.original.real_facturado, row.original.moneda)}
        </span>
      ),
    },
    {
      id: "dif",
      header: "Δ",
      accessorFn: (r) => r.diferencia,
      cell: ({ row }) => {
        const d = row.original.diferencia;
        const cls = d > 0 ? "text-destructive font-medium" : d < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
        return (
          <span className={`text-xs tabular-nums ${cls}`}>
            {formatCurrency(d, row.original.moneda)}
          </span>
        );
      },
    },
    {
      id: "pct",
      header: "%",
      accessorFn: (r) => r.desviacion_pct,
      cell: ({ row }) => {
        const p = row.original.desviacion_pct;
        const cls = p > 0 ? "text-destructive" : p < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";
        return <span className={`text-xs tabular-nums ${cls}`}>{p.toFixed(1)}%</span>;
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (r) => r.estado_liquidacion,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px]">{row.original.estado_liquidacion}</Badge>
      ),
    },
    {
      id: "facturas",
      header: "Facturas",
      accessorFn: (r) => r.facturas.length,
      cell: ({ row }) => {
        const facs = row.original.facturas;
        if (facs.length === 0) {
          return (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `/compras/por-aprobar?embarque=${encodeURIComponent(
                    row.original.concepto_costo_id,
                  )}&concepto=${encodeURIComponent(row.original.concepto_costo_id)}`,
                );
              }}
            >
              <Link2 className="mr-1 h-3 w-3" /> Vincular
            </Button>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {facs.map((f) => (
              <Badge key={f.proveedor_factura_id} variant="secondary" className="text-[10px] font-mono">
                {f.folio_proveedor}
              </Badge>
            ))}
          </div>
        );
      },
    },
  ]);
}

/**
 * Diálogo drill-down de aging: al abrir una fila de proveedor en /compras/aging
 * muestra sus facturas con saldo abierto, con badge de cubeta y exporta a CSV.
 *
 * v13.303.95 · Rediseño al design language del detalle CxP:
 * chip-folio inline, filtro de cubetas como chips en action bar y export en overflow.
 */
import { useMemo, useState } from "react";
import { Download, FileText, X, MoreHorizontal, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { useFacturasCxP } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";
import { bucketDeDias, BUCKET_LABELS, BUCKET_TONES, type CubetaAging } from "./agingBuckets";
import { todayLocalISO } from "@/lib/date/today";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { cn } from "@/lib/utils";

interface Props {
  proveedor: CxpAgingRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cubetaInicial?: CubetaAging | "todas";
}

const CUBETA_CHIPS: Array<{ value: CubetaAging | "todas"; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "vigente", label: "Vigente" },
  { value: "d_1_30", label: "1-30 d" },
  { value: "d_31_60", label: "31-60 d" },
  { value: "d_61_90", label: "61-90 d" },
  { value: "mas_90", label: ">90 d" },
];

export function AgingDrillDownDialog({ proveedor, open, onOpenChange, cubetaInicial = "todas" }: Props) {
  const [cubeta, setCubeta] = useState<CubetaAging | "todas">(cubetaInicial);
  const { data: facturas = [], isLoading } = useFacturasCxP(
    proveedor ? { proveedor_id: proveedor.proveedor_id } : {},
  );

  const abiertas = useMemo(() => facturas.filter((f) => f.saldo > 0), [facturas]);
  const filtradas = useMemo(() => {
    if (cubeta === "todas") return abiertas;
    return abiertas.filter((f) => bucketDeDias(f.dias_vencido) === cubeta);
  }, [abiertas, cubeta]);

  const criticas = proveedor?.mas_90 ?? 0;
  const porVencer = proveedor ? proveedor.vigente : 0;
  const vencido = proveedor ? proveedor.d_1_30 + proveedor.d_31_60 + proveedor.d_61_90 : 0;

  const columns = useMemo(() => defineColumns<FacturaCxP>([
    {
      id: "folio_prov", header: "Folio prov.",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.folio_proveedor}</span>,
    },
    { id: "emision", header: "Emisión", cell: ({ row }) => formatDate(row.original.fecha_emision) },
    {
      id: "vencimiento", header: "Vencimiento",
      cell: ({ row }) => row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "—",
    },
    {
      id: "dias", header: "Días",
      cell: ({ row }) => {
        const dias = row.original.dias_vencido;
        const bucket = bucketDeDias(dias);
        return (
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums text-sm">{dias > 0 ? `+${dias}` : dias}</span>
            <Badge className={BUCKET_TONES[bucket]} variant="outline">{BUCKET_LABELS[bucket]}</Badge>
          </div>
        );
      },
    },
    {
      id: "saldo", header: "Saldo",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.original.saldo, row.original.moneda)}
        </span>
      ),
    },
  ]), []);

  const handleExport = () => {
    if (filtradas.length === 0 || !proveedor) return;
    const headers = ["Folio proveedor", "Emisión", "Vencimiento", "Días", "Cubeta", "Moneda", "Saldo"];
    const lines = filtradas.map((f) => {
      const bucket = bucketDeDias(f.dias_vencido);
      return [
        `"${f.folio_proveedor.replace(/"/g, '""')}"`,
        f.fecha_emision, f.fecha_vencimiento ?? "",
        f.dias_vencido, BUCKET_LABELS[bucket], f.moneda, f.saldo,
      ].join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = proveedor.proveedor_nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    a.download = `aging-${slug}-${todayLocalISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <FileText className="h-5 w-5 text-accent" aria-hidden />
              <DialogTitle className="text-lg font-bold text-primary">
                Facturas con saldo
              </DialogTitle>
              {proveedor && (
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider border">
                  {proveedor.num_facturas} factura{proveedor.num_facturas === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {proveedor && (
              <p className="text-xs text-muted-foreground">
                {proveedor.proveedor_nombre}
              </p>
            )}
          </DialogHeader>

          {proveedor && (
            <div className="px-6 py-3 border-b bg-accent/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {CUBETA_CHIPS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCubeta(c.value)}
                    className={cn(
                      "text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
                      cubeta === c.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Más acciones">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={handleExport} disabled={filtradas.length === 0}>
                    <Download className="h-3.5 w-3.5 mr-2" /> Exportar CSV ({filtradas.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {proveedor && (
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b bg-background">
              <Kpi label="Saldo total" value={formatCurrency(proveedor.saldo_total, "MXN")} />
              <Kpi label="Por vencer" value={formatCurrency(porVencer, "MXN")} />
              <Kpi label="Vencido 1-90 d" value={formatCurrency(vencido, "MXN")} tone={vencido > 0 ? "warn" : "default"} />
              <Kpi
                label="Crítico >90 d"
                value={formatCurrency(criticas, "MXN")}
                tone={criticas > 0 ? "warn" : "default"}
                emphasis={criticas > 0}
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!proveedor ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <AlertTriangle className="h-4 w-4" />
                Selecciona un proveedor.
              </div>
            ) : (
              <DataTable<FacturaCxP>
                columns={columns}
                data={filtradas}
                isLoading={isLoading}
                rowKey={(f) => f.id}
                emptyMessage="Este proveedor no tiene facturas con saldo en esta cubeta"
                density="compact"
                striped
                hoverable
              />
            )}
          </div>

          <div className="px-6 py-3 border-t flex justify-end bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

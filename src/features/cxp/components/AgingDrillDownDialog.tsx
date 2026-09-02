/**
 * Diálogo drill-down de aging: al abrir una fila de proveedor en /compras/aging
 * muestra sus facturas con saldo abierto, con badge de cubeta y exporta a CSV.
 *
 * v13.303.95 · Rediseño al design language del detalle CxP:
 * chip-folio inline, filtro de cubetas como chips en action bar y export en overflow.
 */
import { useMemo, useState } from "react";
import { FileText, X, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { TooltipProvider } from "@/components/ui/tooltip";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { useFacturasCxP } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";
import { bucketDeDias, BUCKET_LABELS, BUCKET_TONE, type CubetaAging } from "./agingBuckets";
import { ToneBadge } from "@/components/shared/ToneBadge";

import { todayLocalISO } from "@/lib/date/today";
import { AgingActionBar, AgingKpiRow } from "./AgingDrillDownDialog.parts";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface Props {
  proveedor: CxpAgingRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cubetaInicial?: CubetaAging | "todas";
}

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

  const columns = useMemo(() => defineColumns<FacturaCxP>([
    {
      id: "folio_prov", header: "Folio prov.",
      cell: ({ row }) => <span className="font-mono text-body-sm">{row.original.folio_proveedor}</span>,
    },
    { id: "emision", header: "Emisión", cell: ({ row }) => formatDate(row.original.fecha_emision) },
    {
      id: "vencimiento", header: "Vencimiento",
      cell: ({ row }) => row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "—",
    },
    {
      id: "dias", header: "Días",
      cell: ({ row }) => {
        const bucket = bucketDeDias(row.original.dias_vencido);
        return (
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums text-body">
              {row.original.dias_vencido > 0 ? `+${row.original.dias_vencido}` : row.original.dias_vencido}
            </span>
            <ToneBadge tone={BUCKET_TONE[bucket]}>{BUCKET_LABELS[bucket]}</ToneBadge>
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
        <DialogContent className={`${dialogSize["3xl"]} max-h-[90vh] flex flex-col gap-0 p-0`}>
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <FileText className="h-5 w-5 text-accent" aria-hidden />
              <DialogTitle className="text-primary">
                Facturas con saldo
              </DialogTitle>
              {proveedor && (
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-body-sm font-mono font-semibold uppercase tracking-wider border">
                  {proveedor.num_facturas} factura{proveedor.num_facturas === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {proveedor && (
              <p className="text-body-sm text-muted-foreground">{proveedor.proveedor_nombre}</p>
            )}
          </DialogHeader>

          {proveedor && (
            <AgingActionBar
              cubeta={cubeta}
              onChange={setCubeta}
              onExport={handleExport}
              exportDisabled={filtradas.length === 0}
              exportCount={filtradas.length}
            />
          )}

          {proveedor && <AgingKpiRow proveedor={proveedor} />}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!proveedor ? (
              <div className="flex items-center gap-2 text-body text-muted-foreground py-8 justify-center">
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
                density={TABLE_DENSITY.embebida}
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

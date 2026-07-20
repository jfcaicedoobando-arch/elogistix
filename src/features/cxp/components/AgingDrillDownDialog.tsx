/**
 * Diálogo drill-down de aging: al abrir una fila de proveedor en /compras/aging
 * muestra sus facturas con saldo abierto, con badge de cubeta y exporta a CSV.
 *
 * v13.205.0 · Ola B · B1
 */
import { useMemo } from "react";
import { Download, FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { useFacturasCxP } from "@/features/cxp/hooks";
import type { FacturaCxP } from "@/features/cxp/services";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";
import { bucketDeDias, BUCKET_LABELS, BUCKET_TONES, type CubetaAging } from "./agingBuckets";
import { todayLocalISO } from "@/lib/date/today";

interface Props {
  proveedor: CxpAgingRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cubetaInicial?: CubetaAging | "todas";
}

export function AgingDrillDownDialog({ proveedor, open, onOpenChange, cubetaInicial = "todas" }: Props) {
  const { data: facturas = [], isLoading } = useFacturasCxP(
    proveedor ? { proveedor_id: proveedor.proveedor_id } : {},
  );

  const abiertas = useMemo(
    () => facturas.filter((f) => f.saldo > 0),
    [facturas],
  );

  const filtradas = useMemo(() => {
    if (cubetaInicial === "todas") return abiertas;
    return abiertas.filter((f) => bucketDeDias(f.dias_vencido) === cubetaInicial);
  }, [abiertas, cubetaInicial]);

  const columns = useMemo(
    () =>
      defineColumns<FacturaCxP>([
        {
          id: "folio_prov",
          header: "Folio prov.",
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.folio_proveedor}</span>
          ),
        },
        {
          id: "emision",
          header: "Emisión",
          cell: ({ row }) => formatDate(row.original.fecha_emision),
        },
        {
          id: "vencimiento",
          header: "Vencimiento",
          cell: ({ row }) =>
            row.original.fecha_vencimiento
              ? formatDate(row.original.fecha_vencimiento)
              : "—",
        },
        {
          id: "dias",
          header: "Días",
          cell: ({ row }) => {
            const dias = row.original.dias_vencido;
            const bucket = bucketDeDias(dias);
            return (
              <div className="flex items-center gap-1.5">
                <span className="tabular-nums text-sm">{dias > 0 ? `+${dias}` : dias}</span>
                <Badge className={BUCKET_TONES[bucket]} variant="outline">
                  {BUCKET_LABELS[bucket]}
                </Badge>
              </div>
            );
          },
        },
        {
          id: "saldo",
          header: "Saldo",
          cell: ({ row }) => (
            <span className="tabular-nums font-medium">
              {formatCurrency(row.original.saldo, row.original.moneda)}
            </span>
          ),
        },
      ]),
    [],
  );

  const handleExport = () => {
    if (filtradas.length === 0 || !proveedor) return;
    const headers = ["Folio proveedor", "Emisión", "Vencimiento", "Días", "Cubeta", "Moneda", "Saldo"];
    const lines = filtradas.map((f) => {
      const bucket = bucketDeDias(f.dias_vencido);
      return [
        `"${f.folio_proveedor.replace(/"/g, '""')}"`,
        f.fecha_emision,
        f.fecha_vencimiento ?? "",
        f.dias_vencido,
        BUCKET_LABELS[bucket],
        f.moneda,
        f.saldo,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            Facturas con saldo · {proveedor?.proveedor_nombre ?? "—"}
          </DialogTitle>
          <DialogDescription>
            {proveedor
              ? `${proveedor.num_facturas} factura(s) abiertas · Saldo total ${formatCurrency(proveedor.saldo_total, "MXN")}`
              : "Selecciona un proveedor."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          <DataTable<FacturaCxP>
            columns={columns}
            data={filtradas}
            isLoading={isLoading}
            rowKey={(f) => f.id}
            emptyMessage="Este proveedor no tiene facturas con saldo abierto"
            density="compact"
            striped
            hoverable
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Cerrar
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={filtradas.length === 0}
          >
            <Download className="h-4 w-4 mr-1" /> Exportar CSV ({filtradas.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

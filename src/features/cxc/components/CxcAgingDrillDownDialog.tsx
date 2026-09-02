/**
 * Drill-down de antigüedad CxC: al abrir una fila de cliente en /cobranza/aging
 * muestra sus facturas con saldo abierto, con badge de cubeta y export a CSV.
 *
 * Espejo del drill-down de CxP (`AgingDrillDownDialog`) para que ambos módulos
 * se vean y se usen igual.
 */
import { useMemo, useState } from "react";
import { FileText, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";
import { bucketDeDias, CUBETA_LABELS, CUBETA_TONE, type CubetaAging } from "@/lib/aging/buckets";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import { CxcAgingActionBar, CxcAgingKpiRow } from "./CxcAgingDrillDownDialog.parts";

interface Props {
  cliente: CxcAgingRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cubetaInicial?: CubetaAging | "todas";
}

function buildColumns() {
  return defineColumns<FacturaCobranza>([
    {
      id: "numero",
      header: "Factura",
      accessorKey: "numero",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">{row.original.numero}</span>
      ),
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorKey: "expediente",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.expediente || "—"}</span>
      ),
    },
    {
      id: "fecha_emision",
      header: "Emisión",
      accessorKey: "fecha_emision",
      cell: ({ row }) => <span className="text-xs">{formatDate(row.original.fecha_emision)}</span>,
    },
    {
      id: "fecha_vencimiento",
      header: "Vence",
      accessorKey: "fecha_vencimiento",
      cell: ({ row }) => (
        <span className="text-xs">{formatDate(row.original.fecha_vencimiento)}</span>
      ),
    },
    {
      id: "cubeta",
      header: "Antigüedad",
      cell: ({ row }) => {
        const b = bucketDeDias(row.original.dias_vencido);
        return <ToneBadge tone={CUBETA_TONE[b]}>{CUBETA_LABELS[b]}</ToneBadge>;
      },
    },
    {
      id: "saldo",
      header: "Saldo",
      accessorKey: "saldo",
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.original.saldo, row.original.moneda)}
        </span>
      ),
      meta: { align: "right" },
    },
  ]);
}

export function CxcAgingDrillDownDialog({
  cliente, open, onOpenChange, cubetaInicial = "todas",
}: Props) {
  const [cubeta, setCubeta] = useState<CubetaAging | "todas">(cubetaInicial);
  const { data: facturas = [], isLoading } = useCobranza(
    cliente ? { cliente_id: cliente.cliente_id } : {},
  );
  const columns = useMemo(() => buildColumns(), []);

  const abiertas = useMemo(
    () =>
      facturas.filter(
        (f) => f.saldo > 0 && (!cliente || f.moneda.toUpperCase() === cliente.moneda),
      ),
    [facturas, cliente],
  );

  const filtradas = useMemo(() => {
    if (cubeta === "todas") return abiertas;
    return abiertas.filter((f) => bucketDeDias(f.dias_vencido) === cubeta);
  }, [abiertas, cubeta]);

  function exportar() {
    const headers = ["Factura", "Expediente", "Emisión", "Vencimiento", "Días vencido", "Antigüedad", "Moneda", "Saldo"];
    const lines = filtradas.map((f) =>
      [
        f.numero,
        `"${(f.expediente ?? "").replace(/"/g, '""')}"`,
        f.fecha_emision,
        f.fecha_vencimiento,
        f.dias_vencido,
        CUBETA_LABELS[bucketDeDias(f.dias_vencido)],
        f.moneda,
        f.saldo,
      ].join(","),
    );
    downloadCsvWithFeedback({
      filename: `aging-cxc-${cliente?.cliente_nombre ?? "cliente"}-${todayLocalISO()}.csv`,
      csv: [headers.join(","), ...lines].join("\n"),
      rowCount: filtradas.length,
      emptyWarning: { description: "No hay facturas con saldo en la cubeta seleccionada." },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${dialogSize["4xl"]} p-0 gap-0 max-h-[90vh] overflow-y-auto`}>
        <TooltipProvider>
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" />
              Facturas con saldo · {cliente?.cliente_nombre ?? ""}
            </DialogTitle>
          </DialogHeader>

          {cliente && <CxcAgingKpiRow cliente={cliente} />}

          <CxcAgingActionBar
            cubeta={cubeta}
            onChange={setCubeta}
            onExport={exportar}
            exportDisabled={filtradas.length === 0}
            exportCount={filtradas.length}
          />

          <div className="p-0">
            <DataTable<FacturaCobranza>
              columns={columns}
              data={filtradas}
              isLoading={isLoading}
              rowKey={(f) => f.id}
              getRowHref={(f) => `/facturacion/${f.id}`}
              getRowAriaLabel={(f) => `Ver factura ${f.numero}`}
              emptyMessage="Sin facturas con saldo"
              emptyHint="Este cliente no tiene facturas abiertas en esta cubeta."
              striped
              hoverable
              density={TABLE_DENSITY.embebida}
            />
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}

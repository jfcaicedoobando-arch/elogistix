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

import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";
import { bucketDeDias, CUBETA_LABELS, type CubetaAging } from "@/lib/aging/buckets";
import { formatDate } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import { CxcAgingActionBar, CxcAgingKpiRow } from "./CxcAgingDrillDownDialog.parts";
import { CxcAgingDrillDownMobileCard } from "./CxcAgingDrillDownMobileCard";
import { clasificarAFecha } from "@/lib/aging/reportScope";
import { buildCxcAgingDrillDownColumns } from "./cxcAgingDrillDownColumns";

interface Props {
  cliente: CxcAgingRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cubetaInicial?: CubetaAging | "todas";
  fechaReferencia?: string;
}

function CxcAgingDrillDownBody({
  cliente, open, onOpenChange, cubetaInicial = "todas", fechaReferencia = todayLocalISO(),
}: Props) {
  const [cubeta, setCubeta] = useState<CubetaAging | "todas">(cubetaInicial);
  const { data: facturas = [], isLoading } = useCobranza(
    cliente ? { cliente_id: cliente.cliente_id } : {},
  );
  const columns = useMemo(() => buildCxcAgingDrillDownColumns(), []);

  const abiertas = useMemo(
    () =>
      clasificarAFecha(facturas, fechaReferencia).filter(
        (f) => f.saldo > 0.005 && (!cliente || f.moneda.toUpperCase() === cliente.moneda),
      ),
    [facturas, cliente, fechaReferencia],
  );

  const filtradas = useMemo(() => {
    if (cubeta === "todas") return abiertas;
    return abiertas.filter((f) => bucketDeDias(f.dias_vencido) === cubeta);
  }, [abiertas, cubeta]);

  function exportar() {
    const headers = ["Factura", "Expediente", "Emisión", "Vencimiento", "Días vencido", "Antigüedad", "Moneda", "Saldo", "Fecha para antigüedad", "Filtro de cubeta"];
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
        fechaReferencia,
        cubeta === "todas" ? "Todas las cubetas" : CUBETA_LABELS[cubeta],
      ].join(","),
    );
    downloadCsvWithFeedback({
      filename: `aging-cxc-${cliente?.cliente_nombre ?? "cliente"}-${fechaReferencia}.csv`,
      csv: [headers.join(","), ...lines].join("\n"),
      rowCount: filtradas.length,
      emptyWarning: { description: "No hay facturas con saldo en la cubeta seleccionada." },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* v13.823.23 — Mismo patrón que el drill-down de CxP: encabezado y
          footer fijos, sólo la tabla hace scroll. */}
      <DialogContent className={`${dialogSize["4xl"]} max-h-[90vh] flex flex-col gap-0 p-0`}>
        <TooltipProvider>
          <DialogHeader className="px-6 py-4 border-b bg-muted/30 space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-accent" aria-hidden />
              Facturas con saldo · {cliente?.cliente_nombre ?? ""}
            </DialogTitle>
            <DialogDescription>
              Facturas abiertas del cliente clasificadas al {formatDate(fechaReferencia)} en la cubeta seleccionada.
            </DialogDescription>
          </DialogHeader>

          {cliente && <CxcAgingKpiRow cliente={cliente} />}

          <CxcAgingActionBar
            cubeta={cubeta}
            onChange={setCubeta}
            onExport={exportar}
            exportDisabled={filtradas.length === 0}
            exportCount={filtradas.length}
          />

          <div className="flex-1 overflow-y-auto">
            <ResponsiveDataTable<FacturaCobranza>
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
              mobileCard={(row) => <CxcAgingDrillDownMobileCard row={row} />}
            />
          </div>

          <div className="px-6 py-3 border-t flex justify-end bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> Cerrar
            </Button>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );

}

/** Cada apertura, entidad o fecha conserva la cubeta solicitada por el reporte. */
export function CxcAgingDrillDownDialog(props: Props) {
  const identity = `${props.cliente?.cliente_id}:${props.cliente?.moneda}:${props.open}:${props.cubetaInicial ?? "todas"}:${props.fechaReferencia}`;
  return <CxcAgingDrillDownBody key={identity} {...props} />;
}

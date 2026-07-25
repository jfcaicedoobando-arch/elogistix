/**
 * QW1 Tanda 1 — Exports reales del Estado de Cuenta.
 * QW12 Tanda 3 — Envío del estado de cuenta por email.
 */
import { FileDown, Sheet } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { formatDate } from "@/lib/formatters";
import { ExportFileButton } from "./ExportFileButton";
import { ExportEmailButton } from "./ExportEmailButton";
import { useExportActions } from "../hooks/useExportActions";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

interface Props {
  clienteIds: string[];
  rows: ReadonlyArray<FacturaEstadoCuenta>;
  desde?: string | null;
  hasta?: string | null;
}

function buildPdfTooltip(soloUnCliente: boolean, sinFilas: boolean): string {
  if (!soloUnCliente) return "El PDF requiere un solo cliente";
  if (sinFilas) return "Sin facturas para exportar";
  return "Descargar estado de cuenta en PDF";
}

function buildCsvTooltip(sinFilas: boolean): string {
  return sinFilas ? "Sin facturas para exportar" : "Descargar filas visibles en CSV";
}

function buildPeriodo(desde: string | null, hasta: string | null): string {
  return desde && hasta ? `${formatDate(desde)} – ${formatDate(hasta)}` : (desde ?? "");
}

export function ExportActions({ clienteIds, rows, desde = "", hasta = "" }: Props) {
  const { busy, onPdf, onCsv, soloUnCliente } = useExportActions(clienteIds, rows);
  const periodo = buildPeriodo(desde, hasta);
  const sinFilas = rows.length === 0;
  const isBusy = busy !== null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <ExportFileButton
          label="PDF"
          icon={FileDown}
          tooltip={buildPdfTooltip(soloUnCliente, sinFilas)}
          busy={busy === "pdf"}
          onClick={onPdf}
          disabled={!soloUnCliente || sinFilas || isBusy}
        />
        <ExportFileButton
          label="CSV"
          icon={Sheet}
          tooltip={buildCsvTooltip(sinFilas)}
          busy={busy === "csv"}
          onClick={onCsv}
          disabled={sinFilas || isBusy}
        />
        {soloUnCliente && (
          <ExportEmailButton
            clienteId={clienteIds[0]}
            clienteNombre={rows[0]?.cliente_nombre ?? null}
            periodo={periodo}
            desde={desde ?? ""}
            hasta={hasta ?? ""}
            rows={rows}
            sinFilas={sinFilas}
            busy={isBusy}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

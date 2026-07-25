/**
 * QW1 Tanda 1 — Exports reales del Estado de Cuenta.
 * PDF (print-to-PDF, requiere un solo cliente) y CSV (planos, cualquier
 * cantidad de clientes). Los datos vienen ya normalizados desde
 * `useEstadoCuenta`; sólo hace falta un adapter a filas planas para CSV.
 *
 * QW12 Tanda 3 — Envío del estado de cuenta por email.
 */
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileDown, Sheet, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { ExportEmailButton } from "./ExportEmailButton";
import { useExportActions } from "../hooks/useExportActions";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

interface Props {
  clienteIds: string[];
  rows: ReadonlyArray<FacturaEstadoCuenta>;
  desde?: string | null;
  hasta?: string | null;
}

export function ExportActions({ clienteIds, rows, desde = "", hasta = "" }: Props) {
  const { busy, onPdf, onCsv, soloUnCliente } = useExportActions(clienteIds, rows);
  const periodo = desde && hasta ? `${formatDate(desde)} – ${formatDate(hasta)}` : (desde || hasta);
  const sinFilas = rows.length === 0;
  const isBusy = busy !== null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={onPdf}
                disabled={!soloUnCliente || sinFilas || isBusy}
              >
                {busy === "pdf"
                  ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  : <FileDown className="h-4 w-4 mr-1.5" />}
                PDF
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {!soloUnCliente
              ? "El PDF requiere un solo cliente"
              : sinFilas
                ? "Sin facturas para exportar"
                : "Descargar estado de cuenta en PDF"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={onCsv}
                disabled={sinFilas || isBusy}
              >
                {busy === "csv"
                  ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  : <Sheet className="h-4 w-4 mr-1.5" />}
                CSV
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {sinFilas ? "Sin facturas para exportar" : "Descargar filas visibles en CSV"}
          </TooltipContent>
        </Tooltip>
        {soloUnCliente && (
          <ExportEmailButton
            clienteId={clienteIds[0]}
            clienteNombre={rows[0]?.cliente_nombre ?? null}
            periodo={periodo ?? ""}
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

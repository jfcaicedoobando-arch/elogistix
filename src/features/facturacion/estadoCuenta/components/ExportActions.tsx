/**
 * QW1 Tanda 1 — Exports reales del Estado de Cuenta.
 * PDF (print-to-PDF, requiere un solo cliente) y CSV (planos, cualquier
 * cantidad de clientes). Los datos vienen ya normalizados desde
 * `useEstadoCuenta`; sólo hace falta un adapter a filas planas para CSV.
 *
 * QW12 Tanda 3 — Envío del estado de cuenta por email.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileDown, Sheet, Loader2 } from "lucide-react";
import { generarEstadoCuentaPdf } from "@/generators/estadoCuentaPdf";
import { exportToCsv } from "@/generators/exportCsv";
import { formatDate } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/lib/ui/appFeedback";
import { ExportEmailButton } from "./ExportEmailButton";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

interface Props {
  clienteIds: string[];
  rows: ReadonlyArray<FacturaEstadoCuenta>;
  desde?: string | null;
  hasta?: string | null;
}

export function ExportActions({ clienteIds, rows, desde = "", hasta = "" }: Props) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const soloUnCliente = clienteIds.length === 1;

  const onPdf = async () => {
    if (!soloUnCliente) return;
    setBusy("pdf");
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, rfc, direccion, ciudad, estado")
        .eq("id", clienteIds[0])
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Cliente no encontrado");
      await generarEstadoCuentaPdf(data);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo generar el PDF",
        error: err as Error,
        method: "ESTADO_CUENTA_EXPORT_PDF",
      });
    } finally {
      setBusy(null);
    }
  };

  const periodo = desde && hasta ? `${formatDate(desde)} – ${formatDate(hasta)}` : (desde || hasta);

  const onCsv = () => {
    setBusy("csv");
    try {
      exportToCsv(
        `estado-de-cuenta-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          { key: "numero", label: "# Factura" },
          { key: "cliente_nombre", label: "Cliente" },
          { key: "expediente", label: "Expediente" },
          { key: "fecha_emision", label: "Emisión" },
          { key: "fecha_vencimiento", label: "Vencimiento" },
          { key: "estado", label: "Estado" },
          { key: "estatus_cobranza", label: "Cobranza" },
          { key: "moneda", label: "Moneda" },
          { key: "total", label: "Total" },
          { key: "saldo", label: "Saldo" },
          { key: "dias_vencido", label: "Días vencido" },
        ],
        rows.map((r) => ({
          numero: r.numero ?? "",
          cliente_nombre: r.cliente_nombre ?? "",
          expediente: r.expediente ?? "",
          fecha_emision: r.fecha_emision ? formatDate(r.fecha_emision) : "",
          fecha_vencimiento: r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : "",
          estado: r.estado_factura ?? "",
          estatus_cobranza: r.estatus_cobranza ?? "",
          moneda: r.moneda ?? "",
          total: r.total ?? 0,
          saldo: r.saldo ?? 0,
          dias_vencido: r.dias_vencido ?? 0,
        })),
      );
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo generar el CSV",
        error: err as Error,
        method: "ESTADO_CUENTA_EXPORT_CSV",
      });
    } finally {
      setBusy(null);
    }
  };

  const sinFilas = rows.length === 0;

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
                disabled={!soloUnCliente || sinFilas || busy !== null}
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
                disabled={sinFilas || busy !== null}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEmailDialogOpen(true)}
                disabled={!soloUnCliente || sinFilas || busy !== null}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Enviar
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {!soloUnCliente
              ? "El envío requiere un solo cliente"
              : sinFilas
                ? "Sin facturas para enviar"
                : "Enviar estado de cuenta por email"}
          </TooltipContent>
        </Tooltip>
      </div>
        {soloUnCliente && (
        <DialogEnviarEstadoCuenta
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          clienteId={clienteIds[0]}
          clienteNombre={rows[0]?.cliente_nombre ?? null}
          periodo={periodo ?? ""}
          desde={desde ?? ""}
          hasta={hasta ?? ""}
          rows={rows}
        />
      )}
    </TooltipProvider>
  );
}

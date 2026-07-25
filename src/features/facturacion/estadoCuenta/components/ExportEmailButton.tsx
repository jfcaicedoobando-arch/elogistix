/**
 * QW12 Tanda 3 — Botón + diálogo para enviar el estado de cuenta por email.
 * Extraído de ExportActions para mantener la complejidad bajo 16.
 */
import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DialogEnviarEstadoCuenta } from "@/features/cobranza/components/DialogEnviarEstadoCuenta";
import type { FacturaEstadoCuenta } from "../services/estadoCuenta";

interface Props {
  clienteId: string;
  clienteNombre: string | null;
  periodo: string;
  desde: string;
  hasta: string;
  rows: ReadonlyArray<FacturaEstadoCuenta>;
  sinFilas: boolean;
  busy: boolean;
}

export function ExportEmailButton({
  clienteId, clienteNombre, periodo, desde, hasta, rows, sinFilas, busy,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={sinFilas || busy}
            >
              <Mail className="h-4 w-4 mr-1.5" />
              Enviar
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {sinFilas ? "Sin facturas para enviar" : "Enviar estado de cuenta por email"}
        </TooltipContent>
      </Tooltip>
      <DialogEnviarEstadoCuenta
        open={open}
        onOpenChange={setOpen}
        clienteId={clienteId}
        clienteNombre={clienteNombre}
        periodo={periodo}
        desde={desde}
        hasta={hasta}
        rows={rows}
      />
    </>
  );
}

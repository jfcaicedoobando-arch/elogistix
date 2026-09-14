/**
 * v13.823.396 · Q2/Q6 — Aviso accionable del Paso 2 cuando los costos
 * automáticos ya no corresponden al Paso 1. El botón reemplaza SÓLO las filas
 * auto-generadas; los renglones capturados a mano se conservan.
 */
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DesajusteCostos } from "@/features/cotizacion/domain/costosAutoGenerados";

interface Props {
  desajuste: DesajusteCostos;
  recalculando?: boolean;
  onRecalcular: () => void;
}

export default function AvisoCostosDesactualizados({ desajuste, recalculando, onRecalcular }: Props) {
  const esTarifa = desajuste === "tarifa_cantidad";
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {esTarifa
            ? "Los costos automáticos de la tarifa se calcularon con otro número de contenedores."
            : "El flete LCL automático no corresponde a los datos capturados en el Paso 1."}{" "}
          Recalcula para actualizarlos; tus renglones capturados a mano se conservan.
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRecalcular}
          disabled={recalculando}
        >
          <RefreshCcw className="size-4 mr-1" />
          {esTarifa ? "Recalcular costos desde tarifa" : "Recalcular flete LCL"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/**
 * v13.823.396 · Q2/Q6 — Aviso accionable del Paso 2 cuando los costos
 * automáticos ya no corresponden al Paso 1. El botón reemplaza SÓLO las filas
 * auto-generadas; los renglones capturados a mano se conservan.
 *
 * P1-3/P2-5: si los costos automáticos son de una tarifa que ya no está
 * vinculada, el usuario decide: recalcular (o quitarlos si ya no hay tarifa)
 * o conservarlos como manuales. Nunca se borra nada en silencio.
 */
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DesajusteCostos } from "@/features/cotizacion/domain/costosAutoGenerados";

interface Props {
  desajuste: DesajusteCostos;
  recalculando?: boolean;
  onRecalcular: () => void;
  onConservar?: () => void;
  /** No hay tarifa vinculada: la acción principal quita los costos automáticos. */
  sinTarifa?: boolean;
}

const TEXTO: Record<DesajusteCostos, string> = {
  tarifa_cantidad: "Los costos automáticos de la tarifa se calcularon con otro número de contenedores.",
  flete_lcl: "El flete LCL automático no corresponde a los datos capturados en el Paso 1.",
  tarifa_distinta: "Hay costos automáticos de una tarifa que ya no está vinculada.",
};

function etiquetaBoton(desajuste: DesajusteCostos, sinTarifa?: boolean): string {
  if (desajuste === "flete_lcl") return "Recalcular flete LCL";
  if (desajuste === "tarifa_distinta" && sinTarifa) return "Quitar costos de la tarifa anterior";
  return "Recalcular costos desde tarifa";
}

export default function AvisoCostosDesactualizados({
  desajuste, recalculando, onRecalcular, onConservar, sinTarifa,
}: Props) {
  const distinta = desajuste === "tarifa_distinta";
  return (
    <Alert variant="warning">
      <AlertTriangle className="size-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {TEXTO[desajuste]}{" "}
          {distinta
            ? "Decide qué hacer con ellos; tus renglones capturados a mano se conservan."
            : "Recalcula para actualizarlos; tus renglones capturados a mano se conservan."}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onRecalcular} disabled={recalculando}>
            <RefreshCcw className="size-4 mr-1" />
            {etiquetaBoton(desajuste, sinTarifa)}
          </Button>
          {distinta && onConservar && (
            <Button type="button" size="sm" variant="ghost" onClick={onConservar} disabled={recalculando}>
              Conservar como manuales
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * DialogRefacturarReceptor — asistente de 5 pasos para refacturar a otro
 * receptor cuando el cliente pagó desde una empresa equivocada.
 *
 *  1. Diagnóstico (cliente destino, ruta fiscal 01/02, motivo) → abre el caso.
 *  2. Cancelar el complemento de pago (REP) del pago recibido.
 *  3. Crear y timbrar la nueva factura al receptor correcto.
 *  4. Cancelar el CFDI original.
 *  5. Reasignar el pago (con ordenante real) y cerrar el caso.
 *
 * El avance se persiste en `refacturaciones.paso_actual`, así que el usuario
 * puede salir a timbrar y regresar sin perder el hilo.
 */
import { Replace } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { Button } from "@/components/ui/button";
import {
  PASOS_REFACTURACION,
  TOTAL_PASOS_REFACTURACION,
  etiquetaAccionPaso,
} from "@/features/facturacion/domain/refacturacionPasos";
import { useRefacturarWizard } from "./useRefacturarWizard";
import { RefacturarPasoActual } from "./RefacturarPasoActual";
import { RefacturacionTrazabilidadCard } from "./RefacturacionTrazabilidadCard";

interface Props {
  facturaId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogRefacturarReceptor({ facturaId, open, onOpenChange }: Props) {
  const cerrar = () => onOpenChange(false);
  const w = useRefacturarWizard(facturaId, open, cerrar);
  const { s } = w;

  if (!facturaId) return null;

  const esUltimo = s.paso === TOTAL_PASOS_REFACTURACION;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Replace}
      size="4xl"
      title={`Refacturar a otro receptor · ${s.original?.numero ?? ""}`}
      description="Corrige el receptor del CFDI conservando el pago y la trazabilidad del embarque."
      step={s.paso}
      totalSteps={TOTAL_PASOS_REFACTURACION}
      stepLabels={[...PASOS_REFACTURACION]}
      stickyBottom={
        w.bloqueo ? (
          <p className="text-xs text-warning-foreground">{w.bloqueo}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Paso {s.paso} de {TOTAL_PASOS_REFACTURACION} validado. Puedes continuar.
          </p>
        )
      }
      footer={
        <FormDialogFooter
          onCancel={cerrar}
          cancelLabel="Cerrar"
          onConfirm={w.handleContinuar}
          confirmLabel={etiquetaAccionPaso(s.paso, Boolean(s.caso))}
          disabled={Boolean(w.bloqueo)}
          loading={w.accionPendiente}
          extra={
            <>
              {s.paso > 1 && (
                <Button variant="outline" onClick={() => s.setPaso(s.paso - 1)}>
                  Atrás
                </Button>
              )}
              {s.caso && !esUltimo && (
                <Button
                  variant="ghost"
                  onClick={() => s.cerrar.mutate(true, { onSuccess: cerrar })}
                  loading={s.cerrar.isPending}
                >
                  Cancelar caso
                </Button>
              )}
            </>
          }
        />
      }
    >
      <RefacturarPasoActual w={w} />

      {s.caso && (
        <details className="mt-6 rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Trazabilidad del caso (expediente y movimientos)
          </summary>
          <div className="pt-3">
            <RefacturacionTrazabilidadCard casoId={s.caso.id} embebido />
          </div>
        </details>
      )}
    </FormDialogShell>
  );
}

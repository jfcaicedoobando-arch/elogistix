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
import { PasoDiagnostico } from "./PasoDiagnostico";
import { PasoCancelarRep } from "./PasoCancelarRep";
import { PasoFacturaNueva } from "./PasoFacturaNueva";
import { PasoCancelarOriginal } from "./PasoCancelarOriginal";
import { PasoReasignarPago } from "./PasoReasignarPago";

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
      {s.paso === 1 && (
        <PasoDiagnostico
          numeroOriginal={s.original?.numero ?? ""}
          clienteOriginal={s.original?.cliente_nombre ?? ""}
          rfcOriginal={s.original?.rfc_cliente ?? null}
          total={s.original?.total ?? null}
          moneda={s.original?.moneda ?? "MXN"}
          clientes={w.clientes}
          clienteDestinoId={w.clienteDestinoId}
          onClienteDestino={w.setClienteDestinoId}
          rutaFiscal={w.rutaFiscal}
          onRutaFiscal={w.setRutaFiscal}
          motivo={w.motivo}
          onMotivo={w.setMotivo}
          bloqueado={Boolean(s.caso)}
        />
      )}

      {s.paso === 2 && (
        <PasoCancelarRep
          pagos={w.pagos}
          cargando={s.pagosCargando}
          cancelandoId={w.repEnCurso}
          onCancelarRep={w.handleCancelarRep}
        />
      )}

      {s.paso === 3 && (
        <PasoFacturaNueva
          facturaNueva={s.facturaNueva}
          clienteDestinoNombre={w.clienteDestinoNombre}
          duplicando={s.duplicar.isPending}
          consultando={s.facturaNuevaCargando}
          onDuplicar={() => s.duplicar.mutate()}
          onIrABorrador={w.handleIrABorrador}
          onRefrescar={s.refrescar}
        />
      )}

      {s.paso === 4 && (
        <PasoCancelarOriginal
          original={s.original}
          rutaFiscal={w.rutaFiscal}
          cancelando={w.cancelandoFactura}
          onCancelar={w.handleCancelarOriginal}
          onRefrescar={s.refrescar}
        />
      )}

      {s.paso === 5 && (
        <PasoReasignarPago
          pagos={w.pagos}
          pagoSeleccionadoId={w.pagoSeleccionadoId}
          onSeleccionarPago={w.setPagoSeleccionadoId}
          facturaNueva={s.facturaNueva}
          ordenanteNombre={w.ordenanteNombre}
          onOrdenanteNombre={w.setOrdenanteNombre}
          ordenanteRfc={w.ordenanteRfc}
          onOrdenanteRfc={w.setOrdenanteRfc}
          yaReasignado={w.yaReasignado}
        />
      )}
    </FormDialogShell>
  );
}

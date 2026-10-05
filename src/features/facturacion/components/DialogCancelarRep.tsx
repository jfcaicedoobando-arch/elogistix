/**
 * Diálogo para cancelar un REP (Complemento de Pago) ante el SAT.
 * Reutiliza el selector de motivos SAT y, tras aceptación, el pago asociado
 * se da de baja y se recalcula el saldo de la factura.
 * El resumen del REP, el selector de motivo y las alertas de resultado viven
 * en `CancelarRepInfoSummary` y `CancelarRepResultadoAlerts`.
 */
import { Ban, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import {
  CancelarRepInfoSummary,
  CancelarRepMotivoSelector,
} from "@/features/facturacion/components/CancelarRepInfoSummary";
import { CancelarRepResultadoAlerts } from "@/features/facturacion/components/CancelarRepResultadoAlerts";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import type { PagoRepInfo, ResultadoCancelacionRep } from "@/features/facturacion/hooks/useCancelarRepController";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pago: PagoRepInfo | null;
  motivo: MotivoCancelacionSat;
  onMotivoChange: (m: MotivoCancelacionSat) => void;
  onConfirm: () => void;
  isPending: boolean;
  resultado: ResultadoCancelacionRep;
}

function folioRep(pago: PagoRepInfo): string {
  const partes = [pago.serie_rep, pago.folio_rep].filter((v) => v != null && v !== "");
  return partes.length ? partes.join("") : "REP";
}

export function DialogCancelarRep({
  open,
  onOpenChange,
  pago,
  motivo,
  onMotivoChange,
  onConfirm,
  isPending,
  resultado,
}: Props) {
  const labelRep = pago ? folioRep(pago) : "";
  const terminado = resultado === "accepted" || resultado === "accepted_sync_failed";
  const mostrarFormulario = !terminado;
  const titulo =
    resultado === "accepted" ? "REP cancelado" :
    resultado === "accepted_sync_failed" ? "REP cancelado · sincronización pendiente" :
    `Cancelar REP ${labelRep}`;
  const descripcion =
    resultado === "accepted"
      ? "El REP fue cancelado ante el SAT. Se dio de baja su cobro y se recalculó el saldo de la factura."
      : resultado === "accepted_sync_failed"
      ? "El SAT aceptó la cancelación, pero no se pudo dar de baja el cobro en el ERP. Revisa el error y actualiza el estado antes de completar la baja local."
      : "La cancelación se enviará al SAT a través de Facturapi. Si la acepta, el ERP dará de baja este cobro y recalculará el saldo de la factura, conservando los demás abonos y créditos.";

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isPending}
      >
        {terminado ? "Cerrar" : "Cancelar"}
      </Button>
      {mostrarFormulario && (
        <Button
          type="button"
          variant="destructive"
          onClick={onConfirm}
          disabled={isPending || !pago}
          loading={isPending}
        >
          {isPending ? "Cancelando…" : "Confirmar cancelación"}
        </Button>
      )}
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Ban}
      title={titulo}
      description={descripcion}
      size="md"
      footer={footer}
      busy={isPending}
    >
      <CancelarRepResultadoAlerts resultado={resultado} />

      {mostrarFormulario && pago && (
        <div className="space-y-5">
          <CancelarRepInfoSummary pago={pago} labelRep={labelRep} />
          <CancelarRepMotivoSelector motivo={motivo} onMotivoChange={onMotivoChange} />
          <div className="flex items-start gap-2 text-body-sm text-muted-foreground">
            <TriangleAlert className="size-4 shrink-0 mt-0.5" />
            <span>
              Una cancelación aceptada no se puede deshacer ante el SAT. Los movimientos
              bancarios generados por este cobro se darán de baja; los importados se
              desvincularán y quedarán pendientes de conciliación. Esto no devuelve dinero en el banco.
            </span>
          </div>
        </div>
      )}
    </FormDialogShell>
  );
}

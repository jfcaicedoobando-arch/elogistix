/**
 * Diálogo para cancelar un REP (Complemento de Pago) ante el SAT.
 * Reutiliza el selector de motivos SAT y, tras aceptación, el pago asociado
 * se elimina para que la factura vuelva a reflejar saldo pendiente.
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
      ? "El complemento de pago fue cancelado ante el SAT y el pago asociado se eliminó. La factura volvió a estado pendiente."
      : resultado === "accepted_sync_failed"
      ? "El SAT aceptó la cancelación, pero no se pudo eliminar el pago local. Revisa el mensaje de error; si el pago ya no existe, actualiza la página. De lo contrario, elimina el pago manualmente para reflejar el saldo pendiente."
      : "La cancelación se enviará al SAT a través de Facturapi. Si el SAT la acepta, el pago se eliminará y la factura quedará pendiente de cobro.";

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
              Esta acción es irreversible ante el SAT. Si la cancelación es aceptada, el pago se
              eliminará y la factura quedará pendiente de cobro.
            </span>
          </div>
        </div>
      )}
    </FormDialogShell>
  );
}

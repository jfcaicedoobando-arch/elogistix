/**
 * Diálogo para cancelar un REP (Complemento de Pago) ante el SAT.
 * Reutiliza el selector de motivos SAT y, tras aceptación, el pago asociado
 * se elimina para que la factura vuelva a reflejar saldo pendiente.
 */
import { Ban, CheckCircle2, Clock3, TriangleAlert, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { MOTIVOS_CANCELACION_SAT } from "@/constants/catalogosSAT";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { MotivoCancelacionSat } from "@/features/facturacion/services/facturapi";
import type { PagoRepInfo, ResultadoCancelacionRep } from "./detalle/useCancelarRepController";

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

function RepInfoSummary({ pago, labelRep }: { pago: PagoRepInfo; labelRep: string }) {
  const uuidCorto = pago.uuid_rep ? `${pago.uuid_rep.slice(0, 8)}…${pago.uuid_rep.slice(-8)}` : "";
  return (
    <div className="rounded-md border p-3 space-y-2 text-body bg-muted/30">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Folio REP</span>
        <span className="font-medium font-mono">{labelRep || "—"}</span>
      </div>
      {uuidCorto && (
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">UUID</span>
          <span className="font-mono text-body-sm">{uuidCorto}</span>
        </div>
      )}
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Fecha de pago</span>
        <span>{formatDate(pago.fecha_pago)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">Monto</span>
        <span className="font-medium">{formatCurrency(Number(pago.monto), pago.moneda)}</span>
      </div>
    </div>
  );
}

function MotivoSelector({ motivo, onMotivoChange }: { motivo: MotivoCancelacionSat; onMotivoChange: (m: MotivoCancelacionSat) => void }) {
  return (
    <div className="space-y-2">
      <Label>Motivo SAT</Label>
      <Select value={motivo} onValueChange={(v) => onMotivoChange(v as MotivoCancelacionSat)}>
        <SelectTrigger aria-label="Motivo de cancelación SAT">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MOTIVOS_CANCELACION_SAT.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ResultadoAlerts({ resultado }: { resultado: ResultadoCancelacionRep }) {
  if (resultado === "accepted") {
    return (
      <Alert variant="success">
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          Cancelación aceptada. El pago fue eliminado y el saldo de la factura se recalculó.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "accepted_sync_failed") {
    return (
      <Alert variant="destructive">
        <CircleAlert className="h-4 w-4" />
        <AlertDescription>
          El SAT aceptó la cancelación del REP, pero no se pudo eliminar el pago local.
          Revisa el mensaje de error. Si el pago aún existe, elimínalo manualmente para que
          la factura vuelva a reflejar saldo pendiente.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "pending" || resultado === "uncertain") {
    return (
      <Alert variant="warning">
        <Clock3 className="h-4 w-4" />
        <AlertDescription>
          El SAT está verificando la cancelación. El pago no se eliminó todavía porque la
          respuesta fiscal aún no es definitiva. Cuando el estado cambie a "Cancelado",
          vuelve a intentar la cancelación o elimina el pago manualmente si ya tienes
          constancia del SAT.
        </AlertDescription>
      </Alert>
    );
  }
  if (resultado === "error") {
    return (
      <Alert variant="destructive">
        <CircleAlert className="h-4 w-4" />
        <AlertDescription>
          No se pudo completar la cancelación. Revisa el mensaje de error; si el REP ya fue
          cancelado previamente, usa "Actualizar estado" desde el detalle.
        </AlertDescription>
      </Alert>
    );
  }
  return null;
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
  const mostrarFormulario = resultado !== "accepted";
  const titulo = resultado === "accepted" ? "REP cancelado" : `Cancelar REP ${labelRep}`;
  const descripcion = resultado === "accepted"
    ? "El complemento de pago fue cancelado ante el SAT y el pago asociado se eliminó. La factura volvió a estado pendiente."
    : "La cancelación se enviará al SAT a través de Facturapi. Si el SAT la acepta, el pago se eliminará y la factura quedará pendiente de cobro.";

  const footer = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isPending}
      >
        {resultado === "accepted" ? "Cerrar" : "Cancelar"}
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
      <ResultadoAlerts resultado={resultado} />

      {mostrarFormulario && pago && (
        <div className="space-y-5">
          <RepInfoSummary pago={pago} labelRep={labelRep} />
          <MotivoSelector motivo={motivo} onMotivoChange={onMotivoChange} />
          <div className="flex items-start gap-2 text-body-sm text-muted-foreground">
            <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
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

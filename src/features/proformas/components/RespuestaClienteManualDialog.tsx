/**
 * Dialog fallback para que el equipo contable/operativo marque la proforma
 * como Aceptada o Rechazada manualmente (cuando el cliente confirmó por otro
 * canal: llamada, WhatsApp, email fuera de sistema).
 *
 * Migrado a FormDialogShell (v13.152.0 — Oleada 3).
 */
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useToast } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { notifyError, notifyWarning } from "@/lib/ui/appFeedback";
import {
  actualizarEstadoClienteProforma,
  type RespuestaCliente,
} from "@/features/proformas/services/respuestaCliente";
import { queryKeys } from "@/lib/query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proformaId: string;
  numero: string;
  modo: Exclude<RespuestaCliente, "pendiente">;
}

export function RespuestaClienteManualDialog({
  open,
  onOpenChange,
  proformaId,
  numero,
  modo,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const esAceptar = modo === "aceptada";

  async function handleConfirmar() {
    if (!esAceptar && !motivo.trim()) {
      notifyError(undefined, { title: "Indica el motivo de rechazo", method: "PROFORMAS_RESPUESTA_MANUAL_VALIDACION" });
      return;
    }
    setLoading(true);
    try {
      await actualizarEstadoClienteProforma(proformaId, modo, motivo);
      toast({
        title: esAceptar
          ? `Proforma ${numero} marcada como aceptada`
          : `Proforma ${numero} marcada como rechazada`,
      });
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
      onOpenChange(false);
      setMotivo("");
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      if (/no tienes permisos|permission denied|not authorized|forbidden|acceso denegado/i.test(msg)) {
        notifyWarning(undefined, {
          title: "Acción no permitida",
          description: msg,
        });
      } else {
        notifyError(undefined, {
          title: "Error al actualizar",
          description: msg,
          error: e,
          method: "PROFORMAS_RESPUESTA_MANUAL",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
        Cancelar
      </Button>
      <Button
        variant={esAceptar ? "default" : "destructive"}
        onClick={handleConfirmar}
        disabled={loading}
      >
        {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        {esAceptar ? "Confirmar aceptación" : "Confirmar rechazo"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={esAceptar ? CheckCircle2 : XCircle}
      title={esAceptar ? "Marcar aceptada por el cliente" : "Marcar rechazada por el cliente"}
      description={
        <>
          Usa esta opción cuando el cliente confirmó la proforma{" "}
          <span className="font-mono">{numero}</span> por otro canal (llamada, WhatsApp, email).
          Quedará registrada en bitácora con tu usuario.
        </>
      }
      size="md"
      footer={footer}
    >
      <div className="space-y-2">
        <Label htmlFor="motivo-manual">
          {esAceptar ? "Nota / referencia (opcional)" : "Motivo de rechazo *"}
        </Label>
        <Textarea
          id="motivo-manual"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={
            esAceptar
              ? "Ej: Confirmado por WhatsApp con Juan Pérez el 02/07/2026."
              : "Ej: Cliente solicita revisar el flete y devolución de contenedor."
          }
          rows={3}
        />
      </div>
    </FormDialogShell>
  );
}

/**
 * EnviarDocumentoDialog — Dialog reutilizable para envío branded al cliente.
 *
 * Encapsula el mismo layout usado en cotizaciones/proformas y ahora facturas:
 *   1. Selector de destinatarios (contactos del cliente + manuales).
 *   2. CC (auto-agrega al usuario logueado).
 *   3. Asunto y mensaje personalizado.
 *   4. Opción "marcar como enviada" (para borradores).
 *
 * El caller sólo provee `clienteId`, el asunto por defecto y `onEnviar`.
 * Toda la lógica de estado vive en `useEnvioDocumentoForm`.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useEnvioDocumentoForm, type EnvioFormState } from "@/hooks/emails/useEnvioDocumentoForm";
import { DestinatariosPicker } from "@/components/shared/emails/DestinatariosPicker";

export interface EnviarDocumentoPayload {
  destinatarios: Array<{ email: string; nombre?: string; contacto_id?: string }>;
  cc: string[];
  asunto: string;
  mensaje: string;
  marcarEnviada: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string | null;
  titulo: string;
  descripcion?: string;
  /** Construye el asunto inicial la primera vez que abre el dialog. */
  buildAsuntoInicial: () => string;
  /** Toggle "marcar como enviada" — sólo aplica cuando el doc está en borrador. */
  mostrarMarcarEnviada?: boolean;
  labelMarcarEnviada?: React.ReactNode;
  labelBotonEnviar?: string;
  labelBotonReenviar?: string;
  esReenvio?: boolean;
  loading?: boolean;
  /** Correos a precargar en el campo CC (heredados del cliente / última factura). */
  ccInicial?: string[] | null;
  onEnviar: (payload: EnviarDocumentoPayload, form: EnvioFormState) => Promise<void> | void;
}

export function EnviarDocumentoDialog({
  open, onOpenChange, clienteId, titulo, descripcion,
  buildAsuntoInicial, mostrarMarcarEnviada, labelMarcarEnviada,
  labelBotonEnviar = "Enviar", labelBotonReenviar = "Reenviar",
  esReenvio, loading, ccInicial, onEnviar,
}: Props) {
  const form = useEnvioDocumentoForm(open, clienteId, buildAsuntoInicial, ccInicial);

  const puedeEnviar = form.destinatarios.length > 0 && !loading;

  const handleSubmit = async () => {
    await onEnviar(
      {
        destinatarios: form.destinatarios,
        cc: form.ccEmails,
        asunto: form.asunto,
        mensaje: form.mensaje,
        marcarEnviada: form.marcarEnviada,
      },
      form,
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Send}
      title={titulo}
      description={descripcion ?? "Se enviará un correo branded al cliente con los adjuntos correspondientes."}
      size="2xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!puedeEnviar}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {esReenvio ? labelBotonReenviar : labelBotonEnviar}
          </Button>
        </>
      }
    >
      <DestinatariosPicker
        contactos={form.contactos}
        loadingContactos={form.loadingContactos}
        seleccionados={form.seleccionados}
        onToggle={(id, v) => form.setSeleccionados((s) => ({ ...s, [id]: v }))}
        emailManual={form.emailManual}
        setEmailManual={form.setEmailManual}
        emailsManualesAgregados={form.emailsManualesAgregados}
        agregarManual={form.agregarManual}
        quitarManual={form.quitarManual}
      />

      <div className="space-y-2">
        <Label>Copia (CC)</Label>
        <div className="flex flex-wrap gap-1 mb-1">
          {form.userEmail && <Badge variant="outline">{form.userEmail} (tú)</Badge>}
        </div>
        <Input
          placeholder="emails adicionales separados por coma"
          value={form.ccManual}
          onChange={(e) => form.setCcManual(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Asunto</Label>
        <Input value={form.asunto} onChange={(e) => form.setAsunto(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Mensaje (opcional)</Label>
        <Textarea
          rows={4}
          value={form.mensaje}
          onChange={(e) => form.setMensaje(e.target.value)}
          placeholder="Mensaje personalizado para el cliente…"
        />
      </div>

      {mostrarMarcarEnviada && (
        <label className="flex items-center gap-2">
          <Checkbox checked={form.marcarEnviada} onCheckedChange={(v) => form.setMarcarEnviada(!!v)} />
          <span className="text-sm">
            {labelMarcarEnviada ?? <>Marcar el documento como <strong>Enviado</strong></>}
          </span>
        </label>
      )}
    </FormDialogShell>
  );
}

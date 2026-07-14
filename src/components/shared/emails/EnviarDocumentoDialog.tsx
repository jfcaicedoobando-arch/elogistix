/**
 * EnviarDocumentoDialog — Dialog reutilizable para envío branded al cliente.
 *
 * Rediseño (v13.300.17): unifica destinatarios y CC bajo un mismo patrón de
 * chip input (`EmailChipsField`) para dar congruencia visual e interacción
 * consistente. Los contactos del cliente se muestran como checkboxes que
 * actúan como atajos: alternan el chip correspondiente en el campo "Para".
 * El usuario logueado aparece como chip con candado en "CC" (no removible).
 *
 * Compatible con el hook `useEnvioDocumentoForm` sin cambios de API pública.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import {
  useEnvioDocumentoForm,
  type EnvioFormState,
} from "@/hooks/emails/useEnvioDocumentoForm";
import { DestinatariosPicker } from "@/components/shared/emails/DestinatariosPicker";
import { EmailChipsField } from "@/components/shared/emails/EmailChipsField";
import { useEnvioChips } from "@/components/shared/emails/useEnvioChips";

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
  buildAsuntoInicial: () => string;
  mostrarMarcarEnviada?: boolean;
  labelMarcarEnviada?: React.ReactNode;
  labelBotonEnviar?: string;
  labelBotonReenviar?: string;
  esReenvio?: boolean;
  loading?: boolean;
  ccInicial?: string[] | null;
  destinatariosInicial?: string[] | null;
  onEnviar: (payload: EnviarDocumentoPayload, form: EnvioFormState) => Promise<void> | void;
}

export function EnviarDocumentoDialog({
  open, onOpenChange, clienteId, titulo, descripcion,
  buildAsuntoInicial, mostrarMarcarEnviada, labelMarcarEnviada,
  labelBotonEnviar = "Enviar", labelBotonReenviar = "Reenviar",
  esReenvio, loading, ccInicial, destinatariosInicial, onEnviar,
}: Props) {
  const form = useEnvioDocumentoForm(open, clienteId, buildAsuntoInicial, ccInicial, destinatariosInicial);
  const chips = useEnvioChips(form);

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
      size="xl"
      footer={
        <>
          <div className="mr-auto text-xs text-muted-foreground">
            {form.destinatarios.length} destinatario{form.destinatarios.length === 1 ? "" : "s"}
            {form.ccEmails.length > 0 && <> · {form.ccEmails.length} en copia</>}
          </div>
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
      <div className="space-y-2">
        <Label htmlFor="envio-para">
          Para <span className="text-destructive">*</span>
        </Label>
        <EmailChipsField
          id="envio-para"
          chips={paraChips}
          onAdd={handleParaAdd}
          onRemove={handleParaRemove}
          ariaLabel="Destinatarios"
          placeholder="escribe un correo o marca un contacto abajo…"
        />
        <DestinatariosPicker
          contactos={form.contactos}
          loadingContactos={form.loadingContactos}
          seleccionados={form.seleccionados}
          onToggle={(id, v) => form.setSeleccionados((s) => ({ ...s, [id]: v }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="envio-cc">Copia (CC)</Label>
        <EmailChipsField
          id="envio-cc"
          chips={ccChips}
          lockedChips={form.userEmail ? [{
            email: form.userEmail,
            label: `${form.userEmail} (tú)`,
            tooltip: "Siempre se agrega tu correo",
          }] : []}
          onAdd={handleCcAdd}
          onRemove={handleCcRemove}
          ariaLabel="Copia CC"
          placeholder="agrega correos en copia…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="envio-asunto">Asunto</Label>
        <Input id="envio-asunto" value={form.asunto} onChange={(e) => form.setAsunto(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="envio-mensaje">Mensaje (opcional)</Label>
        <Textarea
          id="envio-mensaje"
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

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
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import {
  EMAIL_RE,
  useEnvioDocumentoForm,
  type EnvioFormState,
} from "@/hooks/emails/useEnvioDocumentoForm";
import { DestinatariosPicker } from "@/components/shared/emails/DestinatariosPicker";
import {
  EmailChipsField,
  type EmailChip,
} from "@/components/shared/emails/EmailChipsField";

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

  const puedeEnviar = form.destinatarios.length > 0 && !loading;

  // Chips del campo "Para": combina contactos seleccionados + manuales.
  const paraChips: EmailChip[] = useMemo(() => {
    return form.destinatarios.map((d) => {
      const contacto = d.contacto_id
        ? form.contactos.find((c) => c.id === d.contacto_id)
        : undefined;
      return {
        email: d.email,
        label: d.nombre ?? undefined,
        tag: contacto?.tipo ?? undefined,
        invalid: !EMAIL_RE.test(d.email),
      };
    });
  }, [form.destinatarios, form.contactos]);

  // Chips editables del campo "CC" (se serializan a `ccManual` como string).
  const ccChips: EmailChip[] = useMemo(() => {
    return form.ccManual
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => ({ email: e, invalid: !EMAIL_RE.test(e) }));
  }, [form.ccManual]);

  const handleParaAdd = (email: string) => {
    const emailLc = email.toLowerCase();
    const contacto = form.contactos.find((c) => c.email.toLowerCase() === emailLc);
    if (contacto) {
      form.setSeleccionados((s) => ({ ...s, [contacto.id]: true }));
      return;
    }
    if (form.emailsManualesAgregados.some((e) => e.toLowerCase() === emailLc)) return;
    form.setEmailManual(email);
    // Diferimos al siguiente tick para que `agregarManual` lea el valor.
    queueMicrotask(() => form.agregarManual());
  };

  const handleParaRemove = (email: string) => {
    const emailLc = email.toLowerCase();
    const desde = form.destinatarios.find((d) => d.email.toLowerCase() === emailLc);
    if (desde?.contacto_id) {
      form.setSeleccionados((s) => ({ ...s, [desde.contacto_id!]: false }));
    } else {
      form.quitarManual(email);
    }
  };

  const serializeCc = (list: string[]) =>
    form.setCcManual(list.join(", "));

  const handleCcAdd = (email: string) => {
    const emailLc = email.toLowerCase();
    if (ccChips.some((c) => c.email.toLowerCase() === emailLc)) return;
    serializeCc([...ccChips.map((c) => c.email), email]);
  };

  const handleCcRemove = (email: string) => {
    serializeCc(ccChips.map((c) => c.email).filter((e) => e !== email));
  };

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

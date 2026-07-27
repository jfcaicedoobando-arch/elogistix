/**
 * Dialog para enviar la proforma al cliente por email.
 *
 * Fase 2: invoca la edge function `enviar-proforma-email`, que genera un
 * token público, encola el correo con plantilla y registra el envío en
 * `proforma_envios`. Al terminar muestra el enlace del portal copiable.
 */
import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enviarProformaPorEmail } from "@/features/proformas/services/enviarEmail";
import { notifyError } from "@/lib/ui/appFeedback";
import { useDestinatariosSugeridos } from "@/features/proformas/hooks/useDestinatariosSugeridos";
import { useEmailsOcultos } from "@/features/proformas/hooks/useEmailsOcultos";
import { DestinatariosRecientesChips } from "./DestinatariosRecientesChips";
import { EnvioProformaExitoso } from "./EnvioProformaExitoso";
import type { ProformaDetalleFull } from "@/features/proformas/services";
import { queryKeys } from "@/lib/query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proforma: ProformaDetalleFull;
}

function defaultMensaje(p: ProformaDetalleFull): string {
  return [
    `Estimado(a) ${p.cliente_nombre ?? "cliente"},`,
    "",
    `Compartimos la proforma ${p.numero ?? ""} correspondiente al embarque ${p.expediente ?? ""} para su revisión.`,
    "",
    "Desde el botón en el correo podrás aceptarla o rechazarla directamente.",
    "",
    "Saludos cordiales,",
  ].join("\n");
}

interface EnvioOk { enlace_portal: string; estado: string }

export function EnviarProformaDialog({ open, onOpenChange, proforma }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [destinatarios, setDestinatarios] = useState("");
  const [cc, setCc] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState<EnvioOk | null>(null);
  const { data: memoria } = useDestinatariosSugeridos(proforma.cliente_id);
  const { ocultos, isOculto, ocultar, restaurar, restaurarVarios } = useEmailsOcultos(proforma.cliente_id);

  const sugerenciasVisibles = (memoria?.sugerencias ?? []).filter((e) => !isOculto(e));

  useEffect(() => {
    if (open) {
      setAsunto(`Proforma ${proforma.numero ?? ""} para su aprobación`.trim());
      setMensaje(defaultMensaje(proforma));
      setEnviado(null);
      setDestinatarios(memoria?.ultimo?.to.join(", ") ?? "");
      setCc(memoria?.ultimo?.cc.join(", ") ?? "");
    }
  }, [open, proforma, memoria]);

  function agregarEmail(target: "to" | "cc", email: string) {
    const setter = target === "to" ? setDestinatarios : setCc;
    const current = target === "to" ? destinatarios : cc;
    const partes = current.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (partes.includes(email.toLowerCase())) return;
    setter(current ? `${current.replace(/[,;\s]+$/, "")}, ${email}` : email);
  }

  interface EnviarVars {
    to: { email: string }[];
    ccList: string[];
    asunto: string;
    mensaje: string;
  }

  const enviarMut = useMutation({
    mutationKey: queryKeys.proformas.enviarEmail(proforma.id),
    mutationFn: async ({ to, ccList, asunto, mensaje }: EnviarVars) => {
      return enviarProformaPorEmail({
        proformaId: proforma.id,
        destinatarios: to,
        cc: ccList,
        asunto,
        mensaje,
      });
    },
    onSuccess: async (res, vars) => {
      setEnviado(res);
      restaurarVarios([...vars.to.map((t) => t.email), ...vars.ccList]);
      toast({ title: "Correo enviado", description: `Estado: ${res.estado}` });
      await qc.invalidateQueries({ queryKey: queryKeys.proformas.all });
    },
    onError: (e: Error) => {
      notifyError(undefined, {
        title: "No se pudo enviar",
        description: e.message,
        error: e,
        method: "PROFORMAS_ENVIAR_EMAIL",
      });
    },
  });

  function handleEnviar() {
    const to = destinatarios.split(/[,;\s]+/).filter(Boolean).map((email) => ({ email }));
    const ccList = cc.split(/[,;\s]+/).filter(Boolean);
    if (to.length === 0) {
      notifyError(undefined, { title: "Ingresa al menos un destinatario", method: "PROFORMAS_ENVIAR_VALIDACION" });
      return;
    }
    enviarMut.mutate({ to, ccList, asunto, mensaje });
  }

  const loading = enviarMut.isPending;

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Enlace copiado" });
    } catch {
      /* noop */
    }
  }

  const footer = !enviado ? (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
        Cancelar
      </Button>
      <Button onClick={handleEnviar} disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Enviar correo
      </Button>
    </>
  ) : (
    <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Mail}
      title="Enviar proforma al cliente"
      description="El cliente recibirá un correo con un enlace seguro para aceptar o rechazar la proforma."
      size="lg"
      footer={footer}
    >
      {!enviado && (
        <div className="space-y-3">
          <datalist id="proforma-emails-sugeridos">
            {sugerenciasVisibles.map((e) => <option key={e} value={e} />)}
          </datalist>
          <div>
            <Label htmlFor="dest">Para *</Label>
            <Input id="dest" list="proforma-emails-sugeridos" value={destinatarios} onChange={(e) => setDestinatarios(e.target.value)} placeholder="cliente@empresa.com, otro@empresa.com" />
            <DestinatariosRecientesChips
              sugerencias={sugerenciasVisibles}
              ocultos={ocultos}
              onAgregar={(e) => agregarEmail("to", e)}
              onOcultar={ocultar}
              onRestaurar={restaurar}
              onRestaurarVarios={restaurarVarios}
            />
          </div>

          <div>
            <Label htmlFor="cc">CC (opcional)</Label>
            <Input id="cc" list="proforma-emails-sugeridos" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="contabilidad@empresa.com" />
          </div>

          <div>
            <Label htmlFor="asunto">Asunto</Label>
            <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="msg">Mensaje</Label>
            <Textarea id="msg" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={6} />
          </div>
        </div>
      )}

      {enviado && (
        <EnvioProformaExitoso estado={enviado.estado} enlacePortal={enviado.enlace_portal} onCopiar={copiar} />
      )}
    </FormDialogShell>
  );
}

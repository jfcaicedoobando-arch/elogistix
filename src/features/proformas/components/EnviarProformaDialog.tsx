/**
 * Dialog para enviar la proforma al cliente por email.
 *
 * Muestra el resultado por destinatario y permite reconciliar un envío pendiente.
 */
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { useDestinatariosSugeridos } from "@/features/proformas/hooks/useDestinatariosSugeridos";
import { useEmailsOcultos } from "@/features/proformas/hooks/useEmailsOcultos";
import { useEnviarProformaEmail, type EnviarProformaVars } from "@/features/proformas/hooks/useEnviarProformaEmail";
import type { EnviarProformaEmailResult } from "@/features/proformas/services/enviarEmail";
import { DestinatariosRecientesChips } from "./DestinatariosRecientesChips";
import { ResultadoEnvioProforma } from "./ResultadoEnvioProforma";
import type { ProformaDetalleFull } from "@/features/proformas/services";

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

export function EnviarProformaDialog({ open, onOpenChange, proforma }: Props) {
  const { toast } = useToast();
  const [destinatarios, setDestinatarios] = useState("");
  const [cc, setCc] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [envio, setEnvio] = useState<{ resultado: EnviarProformaEmailResult; vars: EnviarProformaVars } | null>(null);
  const { data: memoria } = useDestinatariosSugeridos(proforma.cliente_id);
  const { ocultos, isOculto, ocultar, restaurar, restaurarVarios } = useEmailsOcultos(proforma.cliente_id);

  const sugerenciasVisibles = (memoria?.sugerencias ?? []).filter((e) => !isOculto(e));

  useEffect(() => {
    if (open) {
      setAsunto(`Proforma ${proforma.numero ?? ""} para su aprobación`.trim());
      setMensaje(defaultMensaje(proforma));
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

  const enviarMut = useEnviarProformaEmail(proforma.id, (res, vars) => {
    setEnvio({ resultado: res, vars });
    if (res.estado === "enviado" || res.estado === "parcial") {
      restaurarVarios([...vars.to.map((t) => t.email), ...vars.ccList]);
    }
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
  const cerrar = (next: boolean) => {
    if (loading) return;
    if (!next && envio?.resultado.estado !== "pendiente") setEnvio(null);
    onOpenChange(next);
  };

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Enlace copiado" });
    } catch {
      /* noop */
    }
  }

  const footer = !envio ? (
    <>
      <Button variant="outline" onClick={() => cerrar(false)} disabled={loading}>
        Cancelar
      </Button>
      <Button onClick={handleEnviar} loading={loading}>
        Enviar correo
      </Button>
    </>
  ) : (
    <>
      <Button variant="outline" onClick={() => cerrar(false)} disabled={loading}>Cerrar</Button>
      {envio.resultado.estado === "pendiente" && (
        <Button onClick={() => enviarMut.mutate(envio.vars)} loading={loading}>Reintentar envío</Button>
      )}
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={cerrar}
      icon={Mail}
      title="Enviar proforma al cliente"
      description="El cliente recibirá un correo con un enlace seguro para aceptar o rechazar la proforma."
      size="lg"
      footer={footer}
    >
      {!envio && (
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

      {envio && <ResultadoEnvioProforma resultado={envio.resultado} onCopiar={copiar} />}
    </FormDialogShell>
  );
}

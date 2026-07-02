/**
 * Dialog para enviar la proforma al cliente por email.
 *
 * Fase 1 (MVP): registra el envío en `proforma_envios`, actualiza `enviada_at`
 * y abre `mailto:` con asunto/cuerpo prellenados. El usuario adjunta el PDF
 * desde su cliente de correo (previamente descargado con "Descargar PDF").
 *
 * Fase 2 (pendiente): sustituir mailto por edge function con Resend + adjuntar
 * PDF + botones en el correo con enlace al portal del cliente.
 */
import { useEffect, useState } from "react";
import { Loader2, Mail, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { registrarEnvioProforma } from "@/features/proformas/services/registrarEnvio";
import type { ProformaDetalleFull } from "@/features/proformas/services";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proforma: ProformaDetalleFull;
}

function defaultAsunto(p: ProformaDetalleFull): string {
  return `Proforma ${p.numero ?? ""} — ${p.cliente_nombre ?? ""}`.trim();
}

function defaultMensaje(p: ProformaDetalleFull): string {
  return [
    `Estimado(a) ${p.cliente_nombre ?? "cliente"},`,
    "",
    `Adjunto encontrará la proforma ${p.numero ?? ""} correspondiente al embarque ${p.expediente ?? ""}.`,
    "",
    "Por favor responda a este correo confirmando aceptación o indicando ajustes requeridos.",
    "",
    "Saludos cordiales,",
  ].join("\n");
}

export function EnviarProformaDialog({ open, onOpenChange, proforma }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [destinatarios, setDestinatarios] = useState("");
  const [cc, setCc] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAsunto(defaultAsunto(proforma));
      setMensaje(defaultMensaje(proforma));
    }
  }, [open, proforma]);

  async function handleEnviar() {
    const to = destinatarios.split(/[,;\s]+/).filter(Boolean);
    const ccList = cc.split(/[,;\s]+/).filter(Boolean);
    if (to.length === 0) {
      toast({ title: "Ingresa al menos un destinatario", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await registrarEnvioProforma({
        proformaId: proforma.id,
        organizationId: proforma.organization_id,
        destinatarios: to,
        cc: ccList,
        asunto,
        mensaje,
      });
      toast({ title: "Envío registrado", description: "Abriendo tu cliente de correo…" });
      window.location.href = res.mailtoUrl;
      await qc.invalidateQueries({ queryKey: ["proformas"] });
      onOpenChange(false);
      setDestinatarios("");
      setCc("");
    } catch (e) {
      toast({
        title: "No se pudo registrar el envío",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar proforma al cliente
          </DialogTitle>
          <DialogDescription>
            Se registrará el envío en el historial y se abrirá tu cliente de correo con el
            mensaje prellenado. Adjunta el PDF que descargaste desde el botón "Descargar PDF".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="dest">Para *</Label>
            <Input
              id="dest"
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
              placeholder="cliente@empresa.com, otro@empresa.com"
            />
          </div>
          <div>
            <Label htmlFor="cc">CC (opcional)</Label>
            <Input
              id="cc"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="contabilidad@empresa.com"
            />
          </div>
          <div>
            <Label htmlFor="asunto">Asunto</Label>
            <Input id="asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="msg">Mensaje</Label>
            <Textarea id="msg" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={7} />
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Recuerda adjuntar el PDF descargado antes de enviar. En una próxima iteración
              haremos el envío automático con PDF adjunto y enlace al portal del cliente.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Registrar y abrir correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

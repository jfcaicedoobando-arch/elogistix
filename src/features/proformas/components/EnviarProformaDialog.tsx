/**
 * Dialog para enviar la proforma al cliente por email.
 *
 * Fase 2: invoca la edge function `enviar-proforma-email`, que genera un
 * token público, encola el correo con plantilla y registra el envío en
 * `proforma_envios`. Al terminar muestra el enlace del portal copiable.
 */
import { useEffect, useState } from "react";
import { Loader2, Mail, Copy, CheckCircle2, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
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
import { useToast } from "@/hooks/shared";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { useDestinatariosSugeridos } from "@/features/proformas/hooks/useDestinatariosSugeridos";
import { useEmailsOcultos } from "@/features/proformas/hooks/useEmailsOcultos";
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

interface EnvioOk { enlace_portal: string; estado: string }

export function EnviarProformaDialog({ open, onOpenChange, proforma }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [destinatarios, setDestinatarios] = useState("");
  const [cc, setCc] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
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


  async function handleEnviar() {
    const to = destinatarios.split(/[,;\s]+/).filter(Boolean).map((email) => ({ email }));
    const ccList = cc.split(/[,;\s]+/).filter(Boolean);
    if (to.length === 0) {
      notifyError(toast, { title: "Ingresa al menos un destinatario", method: "PROFORMAS_ENVIAR_VALIDACION" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; enlace_portal: string; estado: string; error?: string }>(
        "enviar-proforma-email",
        { body: { proforma_id: proforma.id, destinatarios: to, cc: ccList, asunto, mensaje } },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error ?? "El envío no se completó.");
      setEnviado({ enlace_portal: data.enlace_portal, estado: data.estado });
      // Reactivar sugerencias para los correos que el usuario acabó usando.
      restaurarVarios([...to.map((t) => t.email), ...ccList]);
      toast({ title: "Correo enviado", description: `Estado: ${data.estado}` });
      await qc.invalidateQueries({ queryKey: ["proformas"] });
    } catch (e) {
      notifyError(toast, {
        title: "No se pudo enviar",
        description: (e as Error).message,
        error: e,
        method: "PROFORMAS_ENVIAR_EMAIL",
      });
    } finally {
      setLoading(false);
    }
  }

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Enlace copiado" });
    } catch {
      /* noop */
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
            El cliente recibirá un correo con un enlace seguro para aceptar o rechazar la proforma.
          </DialogDescription>
        </DialogHeader>

        {!enviado && (
          <div className="space-y-3">
            <datalist id="proforma-emails-sugeridos">
              {sugerenciasVisibles.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
            <div>
              <Label htmlFor="dest">Para *</Label>
              <Input
                id="dest"
                list="proforma-emails-sugeridos"
                value={destinatarios}
                onChange={(e) => setDestinatarios(e.target.value)}
                placeholder="cliente@empresa.com, otro@empresa.com"
              />
              {sugerenciasVisibles.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <span>Recientes:</span>
                  {sugerenciasVisibles.slice(0, 6).map((e) => (
                    <span
                      key={e}
                      className="group inline-flex items-center gap-0.5 rounded border pl-1.5 pr-0.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
                    >
                      <button
                        type="button"
                        onClick={() => agregarEmail("to", e)}
                        className="outline-none"
                      >
                        {e}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          ocultar(e);
                          sonnerToast("Correo ocultado", {
                            description: e,
                            action: {
                              label: "Deshacer",
                              onClick: () => restaurar(e),
                            },
                          });
                        }}
                        aria-label={`Ocultar ${e}`}
                        className="rounded p-0.5 opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {ocultos.length > 0 && (
                <button
                  type="button"
                  onClick={() => restaurarVarios(ocultos)}
                  className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Restaurar ocultos ({ocultos.length})
                </button>
              )}
            </div>

            <div>
              <Label htmlFor="cc">CC (opcional)</Label>
              <Input
                id="cc"
                list="proforma-emails-sugeridos"
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
              <Textarea id="msg" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={6} />
            </div>
          </div>
        )}

        {enviado && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Correo {enviado.estado}</span>
            </div>
            <div>
              <Label className="text-xs uppercase text-muted-foreground">Enlace del portal</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={enviado.enlace_portal} className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => copiar(enviado.enlace_portal)} aria-label="Copiar enlace">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Puedes compartir este enlace por WhatsApp u otro canal si el cliente no recibe el correo.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {!enviado ? (
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
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

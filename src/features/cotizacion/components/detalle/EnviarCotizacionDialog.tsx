import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEnviarCotizacionEmail, type EnvioRow } from "@/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { CotizacionRow } from "@/features/cotizacion/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacion: CotizacionRow;
  totalMxn: number;
  totalUsd: number;
  tasaIva: number;
  envioPrevio?: EnvioRow;
}

interface Contacto {
  id: string;
  nombre: string;
  contacto: string;
  email: string;
  tipo: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EnviarCotizacionDialog({ open, onOpenChange, cotizacion, totalMxn, totalUsd, tasaIva, envioPrevio }: Props) {
  const { user } = useAuth();
  const mutation = useEnviarCotizacionEmail(cotizacion.id);

  const { data: contactos = [], isLoading: loadingContactos } = useQuery({
    queryKey: ["contactos-cliente", cotizacion.cliente_id],
    enabled: !!cotizacion.cliente_id && open,
    queryFn: async (): Promise<Contacto[]> => {
      const { data, error } = await supabase
        .from("contactos_cliente")
        .select("id, nombre, contacto, email, tipo")
        .eq("cliente_id", cotizacion.cliente_id!)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).filter((c) => c.email && EMAIL_RE.test(c.email));
    },
  });

  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [emailManual, setEmailManual] = useState("");
  const [emailsManualesAgregados, setEmailsManualesAgregados] = useState<string[]>([]);
  const [ccManual, setCcManual] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [marcarEnviada, setMarcarEnviada] = useState(true);

  useEffect(() => {
    if (!open) return;
    setAsunto(`Cotización ${cotizacion.folio} — ${cotizacion.origen} → ${cotizacion.destino}`);
    setMensaje("");
    setEmailManual("");
    setEmailsManualesAgregados([]);
    setCcManual("");
    // Pre-seleccionar contactos tipo "Cotizaciones" o el primero
    const pre: Record<string, boolean> = {};
    const prioridad = contactos.find((c) => (c.tipo ?? "").toLowerCase().includes("cotiz"));
    if (prioridad) pre[prioridad.id] = true;
    else if (contactos[0]) pre[contactos[0].id] = true;
    setSeleccionados(pre);
  }, [open, contactos, cotizacion.folio, cotizacion.origen, cotizacion.destino]);

  const destinatarios = useMemo(() => {
    const fromContactos = contactos
      .filter((c) => seleccionados[c.id])
      .map((c) => ({ email: c.email, nombre: c.contacto || c.nombre, contacto_id: c.id }));
    const fromManual = emailsManualesAgregados.map((e) => ({ email: e }));
    // Deduplicar por email
    const seen = new Set<string>();
    return [...fromContactos, ...fromManual].filter((d) => {
      const k = d.email.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [contactos, seleccionados, emailsManualesAgregados]);

  const ccEmails = useMemo(() => {
    const ccUser = user?.email ? [user.email] : [];
    const ccExtra = ccManual.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => EMAIL_RE.test(e));
    const all = [...ccUser, ...ccExtra];
    const dedup: string[] = [];
    const seen = new Set<string>();
    const recipientSet = new Set(destinatarios.map((d) => d.email.toLowerCase()));
    for (const e of all) {
      const k = e.toLowerCase();
      if (seen.has(k) || recipientSet.has(k)) continue;
      seen.add(k);
      dedup.push(e);
    }
    return dedup;
  }, [user?.email, ccManual, destinatarios]);

  const handleAgregarManual = () => {
    const v = emailManual.trim();
    if (!EMAIL_RE.test(v)) return;
    if (emailsManualesAgregados.includes(v)) {
      setEmailManual("");
      return;
    }
    setEmailsManualesAgregados((arr) => [...arr, v]);
    setEmailManual("");
  };

  const puedeEnviar = destinatarios.length > 0 && !mutation.isPending;

  const handleEnviar = async () => {
    try {
      await mutation.mutateAsync({
        cotizacion,
        destinatarios,
        cc: ccEmails,
        mensaje,
        asunto,
        marcarEnviada,
        tasaIva,
        totales: {
          mxn: totalMxn ? formatCurrency(totalMxn, "MXN") : undefined,
          usd: totalUsd ? formatCurrency(totalUsd, "USD") : undefined,
        },
        ejecutivo: {
          nombre: user?.user_metadata?.full_name ?? user?.email ?? undefined,
          email: user?.email ?? undefined,
        },
      });
      onOpenChange(false);
    } catch {
      /* toast ya gestionado en el hook */
    }
  };

  const esReenvio = !!envioPrevio;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {esReenvio ? "Reenviar cotización por correo" : "Enviar cotización por correo"}
          </DialogTitle>
          <DialogDescription>
            Se enviará un correo branded al cliente con el PDF adjunto (link) y un botón al portal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Destinatarios */}
          <div className="space-y-2">
            <Label>Destinatarios</Label>
            {loadingContactos && <p className="text-sm text-muted-foreground">Cargando contactos…</p>}
            {!loadingContactos && contactos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Este cliente no tiene contactos con email. Agrega uno manualmente abajo.
              </p>
            )}
            <div className="space-y-1">
              {contactos.map((c) => (
                <label key={c.id} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox
                    checked={!!seleccionados[c.id]}
                    onCheckedChange={(v) => setSeleccionados((s) => ({ ...s, [c.id]: !!v }))}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {c.contacto || c.nombre}{" "}
                      {c.tipo && <Badge variant="outline" className="ml-1 text-xs">{c.tipo}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  </div>
                </label>
              ))}
            </div>
            {emailsManualesAgregados.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {emailsManualesAgregados.map((e) => (
                  <Badge key={e} variant="secondary" className="gap-1">
                    {e}
                    <button
                      type="button"
                      onClick={() => setEmailsManualesAgregados((arr) => arr.filter((x) => x !== e))}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="agregar email manual"
                value={emailManual}
                onChange={(e) => setEmailManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAgregarManual(); } }}
              />
              <Button type="button" variant="outline" onClick={handleAgregarManual} disabled={!EMAIL_RE.test(emailManual.trim())}>
                Agregar
              </Button>
            </div>
          </div>

          {/* CC */}
          <div className="space-y-2">
            <Label>Copia (CC)</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {user?.email && <Badge variant="outline">{user.email} (tú)</Badge>}
            </div>
            <Input
              placeholder="emails adicionales separados por coma"
              value={ccManual}
              onChange={(e) => setCcManual(e.target.value)}
            />
          </div>

          {/* Asunto */}
          <div className="space-y-2">
            <Label>Asunto</Label>
            <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          </div>

          {/* Mensaje */}
          <div className="space-y-2">
            <Label>Mensaje (opcional)</Label>
            <Textarea
              rows={4}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Mensaje personalizado para el cliente…"
            />
          </div>

          {/* Marcar como enviada */}
          {cotizacion.estado === "Borrador" && (
            <label className="flex items-center gap-2">
              <Checkbox checked={marcarEnviada} onCheckedChange={(v) => setMarcarEnviada(!!v)} />
              <span className="text-sm">Marcar la cotización como <strong>Enviada</strong></span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!puedeEnviar}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {esReenvio ? "Reenviar" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

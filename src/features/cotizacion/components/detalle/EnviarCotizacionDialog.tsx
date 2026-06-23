import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useEnvioCotizacionForm } from "@/features/cotizacion/hooks/useEnvioCotizacionForm";
import { useEnviarCotizacionEmail, type EnvioRow } from "@/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail";
import { DestinatariosPicker } from "@/features/cotizacion/components/detalle/DestinatariosPicker";
import { formatCurrency } from "@/lib/formatters/numbers";
import { useAuth } from "@/lib/contexts/AuthContext";
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

export function EnviarCotizacionDialog({ open, onOpenChange, cotizacion, totalMxn, totalUsd, tasaIva, envioPrevio }: Props) {
  const { user } = useAuth();
  const form = useEnvioCotizacionForm(open, cotizacion.cliente_id ?? null, cotizacion.folio, cotizacion.origen, cotizacion.destino);
  const mutation = useEnviarCotizacionEmail(cotizacion.id);

  const puedeEnviar = form.destinatarios.length > 0 && !mutation.isPending;
  const esReenvio = !!envioPrevio;

  const handleEnviar = async () => {
    try {
      await mutation.mutateAsync({
        cotizacion,
        destinatarios: form.destinatarios,
        cc: form.ccEmails,
        mensaje: form.mensaje,
        asunto: form.asunto,
        marcarEnviada: form.marcarEnviada,
        tasaIva,
        totales: {
          mxn: totalMxn ? formatCurrency(totalMxn, "MXN") : undefined,
          usd: totalUsd ? formatCurrency(totalUsd, "USD") : undefined,
        },
        ejecutivo: {
          nombre: (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? undefined,
          email: user?.email ?? undefined,
        },
      });
      onOpenChange(false);
    } catch {
      /* toast en hook */
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Send}
      title={esReenvio ? "Reenviar cotización por correo" : "Enviar cotización por correo"}
      description="Se enviará un correo branded al cliente con el PDF y un botón al portal."
      size="2xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleEnviar} disabled={!puedeEnviar}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {esReenvio ? "Reenviar" : "Enviar"}
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

      {cotizacion.estado === "Borrador" && (
        <label className="flex items-center gap-2">
          <Checkbox checked={form.marcarEnviada} onCheckedChange={(v) => form.setMarcarEnviada(!!v)} />
          <span className="text-sm">Marcar la cotización como <strong>Enviada</strong></span>
        </label>
      )}
    </FormDialogShell>
  );
}

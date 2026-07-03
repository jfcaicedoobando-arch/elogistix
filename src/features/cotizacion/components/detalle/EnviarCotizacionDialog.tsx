import { EnviarDocumentoDialog } from "@/components/shared/emails/EnviarDocumentoDialog";
import { useEnviarCotizacionEmail, type EnvioRow } from "@/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail";
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
  const mutation = useEnviarCotizacionEmail(cotizacion.id);

  const esReenvio = !!envioPrevio;

  return (
    <EnviarDocumentoDialog
      open={open}
      onOpenChange={onOpenChange}
      clienteId={cotizacion.cliente_id ?? null}
      titulo={esReenvio ? "Reenviar cotización por correo" : "Enviar cotización por correo"}
      descripcion="Se enviará un correo branded al cliente con el PDF y un botón al portal."
      buildAsuntoInicial={() => `Cotización ${cotizacion.folio} — ${cotizacion.origen} → ${cotizacion.destino}`}
      mostrarMarcarEnviada={cotizacion.estado === "Borrador"}
      labelMarcarEnviada={<>Marcar la cotización como <strong>Enviada</strong></>}
      esReenvio={esReenvio}
      loading={mutation.isPending}
      onEnviar={async (payload) => {
        try {
          await mutation.mutateAsync({
            cotizacion,
            destinatarios: payload.destinatarios,
            cc: payload.cc,
            mensaje: payload.mensaje,
            asunto: payload.asunto,
            marcarEnviada: payload.marcarEnviada,
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
      }}
    />
  );
}

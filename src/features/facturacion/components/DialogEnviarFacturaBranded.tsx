/**
 * DialogEnviarFacturaBranded — Envía la factura al cliente con correo branded
 * (PDF y XML como enlaces firmados con TTL 30 días). Usa el dialog compartido
 * `EnviarDocumentoDialog` para homologar el design language con cotizaciones
 * y proformas.
 */
import { EnviarDocumentoDialog } from "@/components/shared/emails/EnviarDocumentoDialog";
import { useEnviarFacturaEmail } from "@/features/facturacion/hooks/mutations/useEnviarFacturaEmail";
import { useAuth } from "@/lib/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { Tables } from "@/integrations/supabase/types";

type FacturaLite = Pick<
  Tables<"facturas">,
  "id" | "numero" | "cliente_id" | "total" | "moneda"
>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  factura: FacturaLite;
  esReenvio?: boolean;
}

export function DialogEnviarFacturaBranded({ open, onOpenChange, factura, esReenvio }: Props) {
  const { user } = useAuth();
  const mutation = useEnviarFacturaEmail(factura.id);

  const totalFormateado = factura.total != null && factura.moneda
    // SAFE-CAST: factura.moneda es enum moneda validado en BD.
    ? formatCurrency(Number(factura.total), factura.moneda as "MXN" | "USD" | "EUR")
    : undefined;

  return (
    <EnviarDocumentoDialog
      open={open}
      onOpenChange={onOpenChange}
      clienteId={factura.cliente_id ?? null}
      titulo={esReenvio ? "Reenviar factura por correo" : "Enviar factura por correo"}
      descripcion="Se enviará un correo branded al cliente con enlaces firmados al PDF y XML (válidos por 30 días)."
      buildAsuntoInicial={() => `Factura ${factura.numero}`}
      esReenvio={esReenvio}
      loading={mutation.isPending}
      onEnviar={async (payload) => {
        try {
          await mutation.mutateAsync({
            facturaId: factura.id,
            destinatarios: payload.destinatarios,
            cc: payload.cc,
            asunto: payload.asunto,
            mensaje: payload.mensaje,
            totalFormateado,
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

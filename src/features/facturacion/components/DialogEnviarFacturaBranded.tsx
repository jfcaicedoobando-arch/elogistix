/**
 * DialogEnviarFacturaBranded — Envía la factura al cliente con correo branded
 * (PDF y XML como enlaces firmados con TTL 30 días). Usa el dialog compartido
 * `EnviarDocumentoDialog` para homologar el design language con cotizaciones
 * y proformas.
 *
 * Recuerda los CC del cliente: al abrir precarga los correos guardados como
 * preferencia (`clientes.email_cc_default`) o, si no existen, los del último
 * envío. Al éxito los persiste como nueva preferencia (best-effort).
 */
import { useQuery } from "@tanstack/react-query";
import { EnviarDocumentoDialog } from "@/components/shared/emails/EnviarDocumentoDialog";
import { useEnviarFacturaEmail } from "@/features/facturacion/hooks/mutations/useEnviarFacturaEmail";
import { useAuth } from "@/lib/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatters/numbers";
import {
  fetchDefaultsFacturacionCliente,
  guardarDefaultsCcCliente,
  guardarDefaultsDestinatariosCliente,
} from "@/features/facturacion/services";
import type { Tables } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/query";
import { logger } from "@/lib/observability/logger";
import { notifyWarning } from "@/lib/ui/appFeedback";

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

  const { data: defaults } = useQuery({
    queryKey: queryKeys.facturacion.clienteDefaults(factura.cliente_id),
    enabled: !!factura.cliente_id && open,
    queryFn: () => fetchDefaultsFacturacionCliente(factura.cliente_id!),
    staleTime: 30_000,
  });

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
      ccInicial={defaults?.cc_emails ?? null}
      destinatariosInicial={defaults?.destinatarios_emails ?? null}
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
          // Best-effort: guarda como preferencia del cliente los CC finales
          // (excluyendo al usuario logueado, que se agrega automáticamente)
          // y los destinatarios manuales (los que no vienen de contactos_cliente).
          if (factura.cliente_id) {
            const userEmailLc = user?.email?.toLowerCase();
            const ccPersist = payload.cc.filter((e) => e.toLowerCase() !== userEmailLc);
            const manualesPersist = payload.destinatarios
              .filter((d) => !d.contacto_id)
              .map((d) => d.email);
            const results = await Promise.allSettled([
              guardarDefaultsCcCliente(factura.cliente_id, ccPersist),
              guardarDefaultsDestinatariosCliente(factura.cliente_id, manualesPersist),
            ]);
            const failed = results.filter((r) => r.status === "rejected");
            if (failed.length > 0) {
              failed.forEach((r) => {
                if (r.status === "rejected") {
                  logger.warn("envio-factura", "no se guardó preferencia del cliente:", r.reason);
                }
              });
              notifyWarning(
                "Factura enviada, pero no pudimos recordar tus destinatarios para la próxima vez.",
              );
            }
          }
          onOpenChange(false);
        } catch {
          /* toast en hook */
        }
      }}
    />
  );
}

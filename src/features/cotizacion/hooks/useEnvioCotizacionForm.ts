/**
 * @deprecated Wrapper de compatibilidad. La lógica vive ahora en
 * `@/hooks/emails/useEnvioDocumentoForm` y es reutilizada por facturas.
 */
import { useEnvioDocumentoForm } from "@/hooks/emails/useEnvioDocumentoForm";

export { EMAIL_RE, type Contacto, type EnvioFormState } from "@/hooks/emails/useEnvioDocumentoForm";

export function useEnvioCotizacionForm(
  open: boolean,
  clienteId: string | null,
  folio: string,
  origen: string,
  destino: string,
) {
  return useEnvioDocumentoForm(
    open,
    clienteId,
    () => `Cotización ${folio} — ${origen} → ${destino}`,
  );
}

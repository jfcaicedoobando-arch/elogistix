import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { deriveErrorCode } from "@/lib/ui/errorCodeDerive";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

interface Props {
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
}

/** Distingue acceso denegado y sesión vencida de un fallo técnico del catálogo. */
export function CatalogQueryError({ error, onRetry, retrying }: Props) {
  const code = deriveErrorCode(error);
  const denied = code === ERROR_CODES.FORBIDDEN;
  const signedOut = code === ERROR_CODES.UNAUTHORIZED;
  return (
    <ErrorStateInline
      title={denied ? "No tienes acceso a este catálogo" : signedOut ? "Tu sesión ha vencido" : "No pudimos cargar el catálogo"}
      message={denied ? "Solicita acceso a un administrador o reintenta si tus permisos cambiaron."
        : signedOut ? "Inicia sesión de nuevo para consultar el catálogo."
        : "Revisa tu conexión e intenta de nuevo."}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}

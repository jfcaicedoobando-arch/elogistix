import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";
import { PageSkeleton } from "@/components/shared/skeletons";

/** UX-05 / UIB-05: skeleton + ErrorState con "Reintentar" para "Mi Perfil". */
export function PerfilAsyncFallback({
  isLoading,
  isError,
  onRetry,
}: {
  isLoading?: boolean;
  isError?: boolean;
  onRetry: () => void;
}) {
  return (
    <AsyncBoundary
      isLoading={isLoading ?? false}
      isError={isError ?? false}
      onRetry={onRetry}
      skeleton={<PageSkeleton />}
      errorTitle="No se pudo cargar tu perfil"
      errorDescription="Revisa tu conexión e inténtalo de nuevo."
    >
      {null}
    </AsyncBoundary>
  );
}

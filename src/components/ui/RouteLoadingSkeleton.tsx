import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * `<RouteLoadingSkeleton />` — placeholder único para los guards de ruta
 * (`ProtectedRoute`, `AgenteProtectedRoute`, `PortalProtectedRoute`) mientras
 * se resuelve la sesión/rol.
 *
 * Antes cada guard tenía su propio `Loader2` a pantalla completa (patrón
 * duplicado 3 veces, auditoría S-1): eso provocaba un "flash" y CLS al
 * hidratar. Un solo `Skeleton` de layout evita el salto visual.
 *
 * `inline` reduce el alto para guards anidados dentro de un layout ya
 * montado (evita empujar/parpadear el sidebar).
 */
interface Props {
  /** Ocupa sólo el área de contenido (guard anidado) en vez de toda la pantalla. */
  inline?: boolean;
  className?: string;
}

export function RouteLoadingSkeleton({ inline = false, className }: Props) {
  return (
    <SkeletonGroup
      loadingLabel="Verificando permisos"
      className={cn(
        "flex w-full flex-col gap-4 p-6",
        inline ? "min-h-[50vh]" : "h-dvh",
        className,
      )}
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </SkeletonGroup>
  );
}

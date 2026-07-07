/**
 * `<CardSkeleton />` — reemplazo de los `<Skeleton className="h-N w-full" />`
 * planos que vivían dentro de cards. Dibuja título + 2-3 líneas de contenido
 * para que la forma se parezca al contenido final.
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Líneas de "cuerpo" del card. Default 3. */
  lines?: number;
  /** Muestra un header (título + subtítulo). Default `true`. */
  showHeader?: boolean;
}

export function CardSkeleton({ className, lines = 3, showHeader = true }: Props) {
  return (
    <SkeletonGroup className={cn("rounded-xl border bg-card p-4 space-y-3", className)}>
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </SkeletonGroup>
  );
}

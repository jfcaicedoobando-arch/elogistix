/**
 * `<PageSkeleton />` — fallback neutro para rutas lazy que no encajan en
 * `DashboardSkeleton` ni `DetailSkeleton`. Dibuja únicamente header +
 * bloque flexible, sin adivinar la estructura interna (evita el "flash"
 * del layout equivocado).
 */
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Alto del bloque de contenido. Default `h-96`. */
  contentHeightClass?: string;
}

export function PageSkeleton({ className, contentHeightClass = "h-96" }: Props) {
  return (
    <SkeletonGroup className={cn("space-y-6 animate-in fade-in duration-200", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0" />
      </div>
      <Skeleton className={cn("w-full rounded-xl", contentHeightClass)} />
    </SkeletonGroup>
  );
}

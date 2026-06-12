import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/empty/EmptyState";
import { PackageX } from "lucide-react";

export function LoadingState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <EmptyState
      icon={PackageX}
      title="Embarque no encontrado"
      description="El embarque que buscas no existe, fue eliminado o no tienes permiso para verlo."
      primaryAction={{ label: "Volver a embarques", onClick: onBack }}
    />
  );
}

import { DetailSkeleton } from "@/components/shared/skeletons";
import EmptyState from "@/components/empty/EmptyState";
import { PackageX } from "lucide-react";

export function LoadingState() {
  return <DetailSkeleton />;
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

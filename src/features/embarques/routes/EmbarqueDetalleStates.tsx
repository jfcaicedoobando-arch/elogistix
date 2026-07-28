import { DetailSkeleton } from "@/components/shared/skeletons";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { PackageX } from "lucide-react";

export function LoadingState() {
  return <DetailSkeleton />;
}

export function NotFoundState() {
  return (
    <DetailNotFound
      icon={PackageX}
      title="Embarque no encontrado"
      description="El embarque que buscas no existe, fue eliminado o no tienes permiso para verlo."
      backTo="/embarques"
      backLabel="Volver a Embarques"
      withContainer={false}
    />
  );
}


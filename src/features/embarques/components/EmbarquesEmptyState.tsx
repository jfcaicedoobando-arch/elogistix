/**
 * Estado vacío del listado de embarques.
 * v13.435.0 — usa el `EmptyState` compartido (patrón único de listados).
 */
import { Ship } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/empty/EmptyState";
import { OrgContextoHint } from "@/components/shared/OrgContextoHint";

interface Props {
  canEdit: boolean;
  onCreate: () => void;
}

export function EmbarquesEmptyState({ canEdit, onCreate }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center px-0 py-0">
        <EmptyState
          icon={Ship}
          title="Aún no tienes embarques"
          description="Comienza registrando tu primer embarque para dar seguimiento a tus operaciones de importación, exportación y más."
          primaryAction={canEdit ? { label: "Crear mi primer embarque", onClick: onCreate } : undefined}
        />
        <OrgContextoHint className="mb-6" />
      </CardContent>
    </Card>
  );
}

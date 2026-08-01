import { Plus, Ship } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrgContextoHint } from "@/components/shared/OrgContextoHint";

interface Props {
  canEdit: boolean;
  onCreate: () => void;
}

export function EmbarquesEmptyState({ canEdit, onCreate }: Props) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div
          aria-hidden="true"
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10"
        >
          <Ship className="h-12 w-12 text-primary" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">Aún no tienes embarques</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Comienza registrando tu primer embarque para dar seguimiento a tus operaciones de importación, exportación y más.
        </p>
        {canEdit && (
          <Button size="lg" onClick={onCreate}>
            <Plus className="h-5 w-5 mr-2" /> Crear mi primer embarque
          </Button>
        )}
        <OrgContextoHint className="mt-6" />
      </CardContent>
    </Card>
  );
}

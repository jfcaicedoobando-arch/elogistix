import { Plus, Ship } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  canEdit: boolean;
  onCreate: () => void;
}

export function EmbarquesEmptyState({ canEdit, onCreate }: Props) {
  return (
    <Card className="shadow-md">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <img
          src="/placeholder.svg"
          alt="Sin embarques"
          className="h-40 w-40 opacity-80 mb-6"
        />
        <div className="flex items-center gap-2 mb-2">
          <Ship className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Aún no tienes embarques</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Comienza registrando tu primer embarque para dar seguimiento a tus operaciones de importación, exportación y más.
        </p>
        {canEdit && (
          <Button size="lg" onClick={onCreate}>
            <Plus className="h-5 w-5 mr-2" /> Crear mi primer embarque
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

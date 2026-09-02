/**
 * Estado vacío del listado de embarques.
 * v13.435.0 — usa el `EmptyState` compartido (patrón único de listados).
 *
 * P2 (2026-09-02): para roles que NO crean embarques (p.ej. coordinador
 * logístico) el estado quedaba sin salida. Ahora explica el flujo real
 * (cotización aprobada → embarque) y ofrece ir a cotizaciones si tiene acceso.
 */
import { Ship } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import EmptyState from "@/components/empty/EmptyState";
import { OrgContextoHint } from "@/components/shared/OrgContextoHint";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";

interface Props {
  canEdit: boolean;
  onCreate: () => void;
}

export function EmbarquesEmptyState({ canEdit, onCreate }: Props) {
  const navigate = useNavigate();
  const { role } = usePermissions();
  const puedeVerCotizaciones = hasRouteAccess(role, "/cotizaciones");

  const descripcion = canEdit
    ? "Comienza registrando tu primer embarque para dar seguimiento a tus operaciones de importación, exportación y más."
    : "Aquí verás los embarques en cuanto se generen desde una cotización aprobada. Con tu rol puedes darles seguimiento, no crearlos.";

  return (
    <Card>
      <CardContent className="flex flex-col items-center px-0 py-0">
        <EmptyState
          icon={Ship}
          title="Aún no tienes embarques"
          description={descripcion}
          primaryAction={canEdit ? { label: "Crear mi primer embarque", onClick: onCreate } : undefined}
          secondaryAction={
            !canEdit && puedeVerCotizaciones
              ? { label: "Ver cotizaciones", onClick: () => navigate("/cotizaciones"), variant: "outline" }
              : undefined
          }
        />
        <OrgContextoHint className="mb-6" />
      </CardContent>
    </Card>
  );
}

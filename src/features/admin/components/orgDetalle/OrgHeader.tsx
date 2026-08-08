import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Building2, CheckCircle2, Trash2, XCircle } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";

interface OrgHeaderProps {
  nombre: string;
  rfc: string | null;
  plan: string | null;
  activo: boolean;
  toggleActivoPending: boolean;
  deletePending: boolean;
  onToggleActivo: (next: boolean) => void;
  onDelete: () => void;
}

export function OrgHeader({ nombre, rfc, plan, activo, toggleActivoPending, deletePending, onToggleActivo, onDelete }: OrgHeaderProps) {
  const volver = useVolver("/admin/organizaciones");
  return (
    <DetailHeader
      backTo={volver}
      backLabel="Volver a Organizaciones"
      icon={<Building2 className="h-6 w-6 text-primary shrink-0" />}
      title={nombre}
      subtitle={`RFC: ${rfc || "—"} · Plan: ${plan}`}
      trailing={
        <div className="flex items-center gap-2">
          <Switch
            checked={activo}
            onCheckedChange={onToggleActivo}
            disabled={toggleActivoPending}
            aria-label={activo ? "Desactivar organización" : "Activar organización"}
          />
          <Badge variant={activo ? "default" : "secondary"} className="gap-1">
            {activo ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {activo ? "Activo" : "Inactivo"}
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={deletePending}
            aria-label="Eliminar organización"
            className="gap-1"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      }
    />
  );
}


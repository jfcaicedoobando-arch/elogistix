/**
 * Chip de vínculo a oportunidad o lead existente en SeccionDestinatario.
 */
import { Briefcase, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  oportunidadId: string;
  leadId: string;
  nombre: string;
  onDesvincular: () => void;
}

export function VinculoChip({ oportunidadId, leadId, nombre, onDesvincular }: Props) {
  const tipoLabel = oportunidadId ? "Oportunidad" : "Lead";
  const Icon = oportunidadId ? Briefcase : UserRound;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <Badge variant="outline" className="border-primary/40 text-primary">
          {tipoLabel}
        </Badge>
        <span className="truncate text-sm font-medium">{nombre || "Sin nombre"}</span>
        {!oportunidadId && leadId && (
          <span className="text-xs text-muted-foreground">
            (se creará la oportunidad al guardar)
          </span>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onDesvincular}>
        <X className="h-4 w-4 mr-1" /> Desvincular
      </Button>
    </div>
  );
}

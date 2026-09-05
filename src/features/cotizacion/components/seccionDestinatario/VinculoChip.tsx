/**
 * Chip de vínculo a oportunidad o lead existente en SeccionDestinatario.
 * P0: un vínculo ya guardado no se puede sustituir desde el cotizador.
 */
import { Briefcase, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  oportunidadId: string;
  leadId: string;
  nombre: string;
  onDesvincular: () => void;
  puedeDesvincular?: boolean;
  /** Bug 1: moneda registrada en la oportunidad (los conceptos deben ir en ella). */
  moneda?: string | null;
}

export function VinculoChip({ oportunidadId, leadId, nombre, onDesvincular, puedeDesvincular = true, moneda }: Props) {
  const tipoLabel = oportunidadId ? "Oportunidad" : "Lead";
  const Icon = oportunidadId ? Briefcase : UserRound;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <Badge variant="outline" className="border-primary/40 text-primary">
          {tipoLabel}
        </Badge>
        <span className="truncate text-body font-medium">{nombre || "Sin nombre"}</span>
        {moneda && (
          <Badge variant="outline" className="shrink-0">
            Moneda {moneda}
          </Badge>
        )}
        {!oportunidadId && leadId && (
          <span className="text-body-sm text-muted-foreground">
            (se usará o abrirá su oportunidad al guardar)
          </span>
        )}
      </div>
      {puedeDesvincular ? (
        <Button type="button" variant="ghost" size="sm" onClick={onDesvincular}>
          <X className="h-4 w-4 mr-1" /> Desvincular
        </Button>
      ) : (
        <span className="text-body-sm text-muted-foreground shrink-0">Vínculo confirmado</span>
      )}
    </div>
  );
}

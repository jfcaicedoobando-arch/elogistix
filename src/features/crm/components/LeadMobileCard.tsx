/**
 * Tarjeta móvil de lead. P1-3: incluye la casilla de selección en lote con la
 * misma regla que escritorio (`puedeSeleccionar`); tocarla no abre el lead.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toTitleCase } from "@/lib/formatters";
import type { CrmLeadRow } from "@/features/crm/hooks";

interface Props {
  lead: CrmLeadRow;
  puedeSeleccionar: boolean;
  seleccionado: boolean;
  onToggle: (id: string) => void;
}

export function LeadMobileCard({ lead: l, puedeSeleccionar, seleccionado, onToggle }: Props) {
  return (
    <div className="flex items-start justify-between gap-2">
      {puedeSeleccionar && (
        <div
          data-no-row-nav
          className="-m-2 flex size-11 shrink-0 items-center justify-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={seleccionado}
            onCheckedChange={() => onToggle(l.id)}
            aria-label={`Seleccionar lead ${l.empresa}`}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-body truncate">{toTitleCase(l.empresa)}</div>
        <div className="text-body-sm text-muted-foreground truncate mt-0.5">{toTitleCase(l.contacto ?? "") || l.email || "—"}</div>
        <div className="text-label text-muted-foreground mt-0.5">{l.fuente}{typeof l.score === "number" ? ` · score ${l.score}` : ""}</div>
      </div>
      <StatusBadge domain="lead" status={l.estado} />
    </div>
  );
}

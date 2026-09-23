import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { toTitleCase } from "@/lib/formatters";
import type { AgenteRow } from "./CosteoAgentesTable";

export function CosteoAgenteMobileCard({ agente, onAcciones }: {
  agente: AgenteRow;
  onAcciones: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-body break-words">{toTitleCase(agente.nombre) || "—"}</p>
          <Badge variant={agente.activo ? "default" : "neutral"}>{agente.activo ? "Activo" : "Inactivo"}</Badge>
        </div>
        <p className="text-body-sm text-muted-foreground">{agente.pais ?? "País no registrado"} · {agente.dias_credito ?? "—"} días de crédito</p>
        <p className="text-body-sm break-all">{toTitleCase(agente.contacto_tarifario ?? "") || "Sin contacto"}</p>
        {agente.email && <p className="text-label text-muted-foreground break-all">{agente.email}</p>}
      </div>
      <Button size="icon" variant="outline" onClick={(e) => { e.stopPropagation(); onAcciones(); }} aria-label={`Editar ${agente.nombre}`}>
        <MoreHorizontal className="size-4" />
      </Button>
    </div>
  );
}
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
import { destinoDe, etiquetaPuertoCompleta, origenDe } from "@/features/costeo/utils/puertoLabel";
import type { FilaRuta } from "./CosteoRutasTable";

interface Props {
  fila: FilaRuta;
  onVer: () => void;
  onEliminar: () => void;
}

export function CosteoRutasMobileCard({ fila, onVer, onEliminar }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 text-body">
          <p className="font-medium break-words">{etiquetaPuertoCompleta(origenDe(fila.ruta))}</p>
          <p className="text-muted-foreground">a {etiquetaPuertoCompleta(destinoDe(fila.ruta))}</p>
        </div>
        <StatusBadge domain="ruta_maritima" status={fila.meta.label} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t pt-2">
        <span className="text-body-sm text-muted-foreground">
          {fila.ruta.tarifas_vigentes_count ?? 0} tarifas vigentes
        </span>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={onVer}>
            <ExternalLink className="mr-1 size-4" /> Ver tarifas
          </Button>
          <Button size="icon" variant="ghost" onClick={onEliminar} aria-label="Eliminar ruta">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
/**
 * Barra flotante de acciones para selección múltiple de hallazgos.
 * Se renderiza encima de la tabla cuando hay al menos un hallazgo seleccionado.
 */
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  onMarcar: () => void;
  onLimpiar: () => void;
}

export function HallazgosBulkBar({ count, onMarcar, onLimpiar }: Props) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium text-primary">
        {count} hallazgo{count === 1 ? "" : "s"} seleccionado{count === 1 ? "" : "s"}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1"
          onClick={onLimpiar}
        >
          <X className="h-3.5 w-3.5" /> Limpiar
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onMarcar}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Marcar como revisados
        </Button>
      </div>
    </div>
  );
}

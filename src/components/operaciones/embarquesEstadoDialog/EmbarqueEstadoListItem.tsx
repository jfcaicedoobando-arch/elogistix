import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { formatDate, toTitleCase } from "@/lib/formatters";
import type { EmbarquesPorEstadoBucket, EstadoUiKey } from "@/hooks/operaciones";
import { calcularExtra, toneClass, subtituloPartes, rutaTexto } from "./extras";

type EmbarqueItem = EmbarquesPorEstadoBucket["items"][number];

interface Props {
  e: EmbarqueItem;
  estado: EstadoUiKey;
  onNavigate: () => void;
}

export function EmbarqueEstadoListItem({ e, estado, onNavigate }: Props) {
  const subt = subtituloPartes(e);
  const ruta = rutaTexto(e);
  const extra = calcularExtra(estado, e);

  return (
    <li>
      <Link
        to={`/embarques/${e.id}`}
        onClick={onNavigate}
        className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-md hover:bg-muted/60 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{e.expediente}</span>
            <span className="text-xs text-muted-foreground truncate">
              {toTitleCase(e.clienteNombre || "Sin cliente")}
            </span>
            {subt.length > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5">{subt.join(" · ")}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
            {ruta && <span className="truncate">{ruta}</span>}
            {e.etd && <span>ETD {formatDate(e.etd)}</span>}
            {e.eta && <span>ETA {formatDate(e.eta)}</span>}
            {extra && <span className={toneClass(extra.tone)}>· {extra.label}</span>}
          </div>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </Link>
    </li>
  );
}

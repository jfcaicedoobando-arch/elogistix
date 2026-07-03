import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";

interface Props {
  cotizacionGanadoraId: string | null;
  embarqueGanadorId: string | null;
}

export function OportunidadGanadaBanner({ cotizacionGanadoraId, embarqueGanadorId }: Props) {
  if (!cotizacionGanadoraId && !embarqueGanadorId) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
      <Trophy className="h-5 w-5 text-success shrink-0" />
      <div className="flex-1">
        <p className="font-medium text-success dark:text-success">
          Oportunidad ganada
        </p>
        <p className="text-xs text-muted-foreground">
          {cotizacionGanadoraId && (
            <>
              Cotización:{" "}
              <Link to={`/cotizaciones/${cotizacionGanadoraId}`} className="underline">
                ver cotización
              </Link>
            </>
          )}
          {cotizacionGanadoraId && embarqueGanadorId && " · "}
          {embarqueGanadorId && (
            <>
              Embarque:{" "}
              <Link to={`/embarques/${embarqueGanadorId}`} className="underline">
                ver embarque
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

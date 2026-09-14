import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";

/**
 * B6 — el aviso ofrece camino de acción: enlaza a la pestaña "Notas y Actividad"
 * del mismo embarque (`?tab=notas`) sin navegación imperativa.
 */
export function AvisoFechasFueraDeOrden() {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-body-sm text-warning">
      <TriangleAlert className="size-3.5 shrink-0" />
      <span>
        Fechas de etapas fuera de orden —{" "}
        <Link
          to={{ search: "?tab=notas" }}
          className="underline underline-offset-2 font-medium hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          revisar bitácora
        </Link>
      </span>
    </div>
  );
}

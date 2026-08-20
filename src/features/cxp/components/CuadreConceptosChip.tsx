/**
 * Semáforo vivo de cuadre de conceptos vs subtotal (v13.629.0).
 * Se usa en el `headerAside` del modal de edición de conceptos.
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { EstadoCuadre } from "@/features/cxp/utils/cuadreConceptos";

interface Props {
  estado: EstadoCuadre;
  suma: number;
  subtotal: number;
  diferencia: number;
  moneda: string;
}

export function CuadreConceptosChip({ estado, suma, subtotal, diferencia, moneda }: Props) {
  const cuadrado = estado === "cuadrado";
  const sinConceptos = estado === "sin_conceptos";

  return (
    <div className="space-y-1">
      <span
        className={
          cuadrado
            ? "inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-label font-medium text-success"
            : "inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/10 px-2.5 py-1 text-label font-medium text-warning-foreground"
        }
      >
        {cuadrado ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        {cuadrado
          ? "Cuadrado"
          : sinConceptos
            ? "Sin partidas"
            : `${diferencia > 0 ? "Faltan" : "Sobran"} ${formatCurrency(Math.abs(diferencia), moneda)}`}
      </span>
      <p className="text-label leading-tight text-muted-foreground">
        Suma <span className="font-medium tabular-nums text-foreground">{formatCurrency(suma, moneda)}</span>
        {" · "}
        Subtotal <span className="font-medium tabular-nums text-foreground">{formatCurrency(subtotal, moneda)}</span>
      </p>
    </div>
  );
}

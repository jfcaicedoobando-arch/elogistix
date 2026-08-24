/**
 * Avisos de tipo de cambio de Tesorería: badge de T/C (DOF vs. respaldo, EC-10)
 * y alerta cuando el saldo bancario total excluye monedas sin T/C confiable.
 *
 * v13.660.0 — Extraído de `Tesoreria.tsx` para bajar su complejidad ciclomática
 * por debajo del límite del lint.
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatTipoCambio} from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters";

interface Props {
  /** T/C USD usado para consolidar saldos; `null` si no hay ninguno. */
  tipoCambioUsd: number | null;
  /** Fecha del T/C publicado, cuando existe. */
  tipoCambioFecha: string | null;
  /** El T/C viene del respaldo operativo, no del DOF. */
  tcEstimado: boolean;
  /** El total bancario dejó fuera monedas por falta de T/C. */
  saldoIncompleto: boolean;
  /** Saldos por moneda, para listar lo excluido. */
  saldosPorMoneda: Record<string, number>;
}

function etiquetaTc(tipoCambioUsd: number | null, tipoCambioFecha: string | null, tcEstimado: boolean) {
  if (tcEstimado) return `T/C estimado ${formatTipoCambio(tipoCambioUsd)} · no oficial`;
  if (!tipoCambioUsd) return "TC DOF no disponible";
  const fecha = tipoCambioFecha ? ` · ${formatFechaEs(tipoCambioFecha)}` : "";
  return `TC DOF ${formatTipoCambio(tipoCambioUsd)}${fecha}`;
}

function variantTc(tipoCambioUsd: number | null, tcEstimado: boolean) {
  if (tcEstimado) return "warning" as const;
  return tipoCambioUsd ? ("outline" as const) : ("secondary" as const);
}

// E-16: la variante `info` (azul claro sobre fondo claro) no cumple 4.5:1.
// Para el chip de TC DOF usamos `text-primary` sobre `bg-primary/10`, que sí
// pasa AA, en vez del par de tokens `info` (reservado a otros contextos).
function claseTc(tipoCambioUsd: number | null, tcEstimado: boolean): string | undefined {
  if (tcEstimado || !tipoCambioUsd) return undefined;
  return "border-transparent bg-primary/10 text-primary hover:bg-primary/15";
}

export function TesoreriaTcAvisos({
  tipoCambioUsd,
  tipoCambioFecha,
  tcEstimado,
  saldoIncompleto,
  saldosPorMoneda,
}: Props) {
  const excluidas = Object.entries(saldosPorMoneda)
    .filter(([moneda]) => moneda !== "MXN")
    .map(([moneda, monto]) => formatCurrency(monto, moneda))
    .join(", ");

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge
          variant={variantTc(tipoCambioUsd, tcEstimado)}
          className={cn(claseTc(tipoCambioUsd, tcEstimado))}
        >
          {etiquetaTc(tipoCambioUsd, tipoCambioFecha, tcEstimado)}
        </Badge>
      </div>

      {saldoIncompleto ? (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No hay tipo de cambio confiable: el saldo bancario total excluye {excluidas}.
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  );
}

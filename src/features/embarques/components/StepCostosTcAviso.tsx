/**
 * Aviso no bloqueante cuando el T/C capturado a mano se aparta del DOF sugerido.
 * v13.553.0 — el operador puede seguir con su número, pero lo ve comparado.
 */
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { formatFechaEs } from "@/lib/formatters";
import { TC_DESVIACION_UMBRAL_PCT } from "@/features/embarques/services/tcEmbarqueDof";
import { desviacionTcPct } from "@/features/embarques/domain/tcDesviacion";
import type { TcInicial } from "@/features/catalogos/hooks/useTcInicial";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

interface Props {
  /** T/C sugerido (DOF preferente). */
  tcInicial: TcInicial | null | undefined;
  /** T/C USD capturado en el formulario (0 cuando falta). */
  tcUsdCapturado: number;
}

export function StepCostosTcAviso({ tcInicial, tcUsdCapturado }: Props) {
  const { setValue } = useFormContext<EmbarqueFormValues>();

  // EC-10: si el TC precargado proviene del respaldo operativo (17.25/18.5,
  // no Banxico/DOF), el P&L del embarque se valuaria con un número estimado.
  // Aviso no bloqueante: el operador puede corregir el TC a mano.
  if (tcInicial?.esFallback) {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">
        <span className="text-warning-foreground">
          <strong>Tipo de cambio de respaldo.</strong> No se pudo obtener el TC oficial
          (Banxico/DOF); el valor precargado (USD ≈ {tcInicial.usdMxn.toFixed(4)}) es una
          estimación operativa. Verifícalo antes de cerrar costos del embarque.
        </span>
      </div>
    );
  }

  if (!tcInicial || tcInicial.fuente !== "DOF") return null;
  const pct = desviacionTcPct(tcUsdCapturado, tcInicial.usdMxn);
  if (pct == null || Math.abs(pct) <= TC_DESVIACION_UMBRAL_PCT) return null;

  const usarDof = () => {
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    setValue("tipoCambioUSD", String(tcInicial.usdMxn), opts);
    if (tcInicial.eurMxn != null) setValue("tipoCambioEUR", String(tcInicial.eurMxn), opts);
  };

  return (
    <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs flex flex-wrap items-center gap-2">
      <span className="text-warning-foreground">
        Capturaste {tcUsdCapturado.toFixed(4)}; el DOF del {formatFechaEs(tcInicial.fecha)} publicó{" "}
        {tcInicial.usdMxn.toFixed(4)} ({pct > 0 ? "+" : ""}
        {pct.toFixed(2)}%). Puedes continuar, pero el P&L usará tu número.
      </span>
      <Button type="button" variant="outline" size="sm" onClick={usarDof}>
        Usar el del DOF
      </Button>
    </div>
  );
}

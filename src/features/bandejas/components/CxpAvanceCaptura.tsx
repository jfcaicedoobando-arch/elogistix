import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import { roundMoney } from "@/lib/financial/financialUtils";
import type { CxpPorCapturarRow } from "../services/bandejas";

/** Cada moneda mantiene su propio presupuesto: no se comparan nominales. */
export function CxpAvanceCaptura({ row }: { row: CxpPorCapturarRow }) {
  const avances = [
    { moneda: "MXN", presupuesto: roundMoney(Number(row.presupuestado_mxn)), capturado: roundMoney(Number(row.facturado_mxn)) },
    { moneda: "USD", presupuesto: roundMoney(Number(row.presupuestado_usd)), capturado: roundMoney(Number(row.facturado_usd)) },
  ].filter((a) => a.presupuesto > 0 || a.capturado !== 0);
  if (avances.length === 0) return <span className="text-muted-foreground">Sin presupuesto ni captura</span>;
  return <div className="space-y-2">
    <p className="text-label text-muted-foreground">Base sin IVA</p>
    {avances.map(({ moneda, presupuesto, capturado }) => {
      const porcentaje = presupuesto > 0 ? Math.round(capturado / presupuesto * 100) : null;
      const exceso = roundMoney(capturado - presupuesto);
      return <div key={moneda} className="space-y-0.5">
        <div className="flex items-center gap-2 text-label tabular-nums">
          <span className="font-medium">{moneda}</span>
          {porcentaje != null && <Progress aria-label={`Captura ${moneda}`}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, porcentaje))}
            aria-valuetext={`${porcentaje}% capturado en ${moneda}`}
            value={Math.max(0, Math.min(100, porcentaje))} className="h-2 flex-1" />}
          <span className={exceso > 0 ? "text-warning font-medium" : "text-muted-foreground"}>
            {porcentaje == null ? "Sin presupuesto" : `${porcentaje}%`}
          </span>
        </div>
        <div className="text-label text-muted-foreground tabular-nums">
          {formatCurrency(capturado, moneda)} / {formatCurrency(presupuesto, moneda)}
        </div>
        {exceso > 0 && <p className="text-label text-warning">
          Excede el presupuesto en {formatCurrency(exceso, moneda)}
        </p>}
      </div>;
    })}
  </div>;
}

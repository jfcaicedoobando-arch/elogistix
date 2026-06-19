/**
 * Desglose colapsable de recargos de una tarifa.
 * Extraído de TarifaResultCard para cumplir Power of 10 (≤200 líneas).
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usdTarifa } from "@/features/costeo/utils/tarifaFormatters";

interface RecargoItem {
  id: string;
  concepto: string;
  lado: string;
  monto: number | string;
}

export function TarifaCardDesglose({ recargos }: { recargos: RecargoItem[] }) {
  const [abierto, setAbierto] = useState(false);
  if (recargos.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-full justify-between py-1"
        aria-expanded={abierto}
      >
        <span>Ver desglose ({recargos.length} {recargos.length === 1 ? "recargo" : "recargos"})</span>
        {abierto ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {abierto && (
        <div className="text-xs space-y-1 mt-1 pl-1 border-l-2 border-border">
          {recargos.map((r) => (
            <div key={r.id} className="flex items-baseline justify-between gap-2 pl-2">
              <span className="text-muted-foreground truncate">{r.concepto} ({r.lado})</span>
              <span className="tabular-nums whitespace-nowrap">{usdTarifa(Number(r.monto))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

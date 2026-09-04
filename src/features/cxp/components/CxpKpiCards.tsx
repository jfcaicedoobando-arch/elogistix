/**
 * Grid de KPIs para la página CxP. Extraído de Cxp.tsx para mantener el page < 200 líneas.
 */
import { useMemo } from "react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { resumirTarjetasCxP } from "@/features/cxp/services/cxpKpiConteos";
import type { FacturaCxP, KPIsCxP } from "@/features/cxp/services";

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "factura" : "facturas"}`;
}

/** Versión corta para sublabels que ya llevan un importe (evita truncado). */
function countLabelCorto(count: number): string {
  return `${count} fact.`;
}

export function CxpKpiCards({ kpis, data }: { kpis: KPIsCxP; data: FacturaCxP[] }) {
  // Los conteos salen del MISMO canon que los importes (`resumirTarjetasCxP`
  // usa `esFacturaPorPagar` + la ventana canónica de 7 días).
  const {
    porPagarMxn, porPagarUsd, vencidasN, porVencerN,
    programadoMxn, programadoUsd, programadoN,
  } = useMemo(() => resumirTarjetasCxP(data), [data]);
  return (
    // Ola 9: a 1280x720 las 5 tarjetas truncaban el importe ("MXN 80,234…") y
    // la etiqueta con el conteo. Ahora el valor va en notación compacta con
    // tooltip del importe exacto, y el conteo de facturas baja al sublabel.
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
      <KpiCard
        label="Por pagar MXN"
        value={formatCurrencyCompact(kpis.por_pagar_mxn, "MXN")}
        valueTooltip={formatCurrency(kpis.por_pagar_mxn, "MXN")}
        sublabel={countLabel(porPagarMxn)}
      />
      <KpiCard
        label="Por pagar USD"
        value={formatCurrencyCompact(kpis.por_pagar_usd, "USD")}
        valueTooltip={formatCurrency(kpis.por_pagar_usd, "USD")}
        sublabel={countLabel(porPagarUsd)}
      />
      <KpiCard
        label="Vencido"
        value={formatCurrencyCompact(kpis.vencido_mxn, "MXN")}
        valueTooltip={formatCurrency(kpis.vencido_mxn, "MXN")}
        sublabel={`${formatCurrency(kpis.vencido_usd, "USD")} · ${countLabelCorto(vencidasN)}`}
        variant="destructive"
      />
      {/* El cálculo de `por_vencer_7d_*` usa una ventana de 7 días: la etiqueta
          decía "5d" y no coincidía con el dato mostrado. */}
      <KpiCard
        label="Por vencer 7d"
        value={formatCurrencyCompact(kpis.por_vencer_7d_mxn, "MXN")}
        valueTooltip={formatCurrency(kpis.por_vencer_7d_mxn, "MXN")}
        sublabel={`${formatCurrency(kpis.por_vencer_7d_usd, "USD")} · ${countLabelCorto(porVencerN)}`}
        variant="warning"
      />
      <KpiCard
        label="Programado 7d"
        value={formatCurrencyCompact(programadoMxn, "MXN")}
        valueTooltip={formatCurrency(programadoMxn, "MXN")}
        sublabel={`${formatCurrency(programadoUsd, "USD")} · ${countLabelCorto(programadoN)}`}
      />
    </div>
  );
}


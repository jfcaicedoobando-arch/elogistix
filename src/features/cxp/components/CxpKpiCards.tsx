/**
 * Grid de KPIs para la página CxP. Extraído de Cxp.tsx para mantener el page < 200 líneas.
 */
import { useMemo } from "react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { FacturaCxP, KPIsCxP } from "@/features/cxp/services";

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "factura" : "facturas"}`;
}

/** Versión corta para sublabels que ya llevan un importe (evita truncado). */
function countLabelCorto(count: number): string {
  return `${count} fact.`;
}

export function CxpKpiCards({ kpis, data }: { kpis: KPIsCxP; data: FacturaCxP[] }) {
  const {
    porPagarMxn, porPagarUsd, vencidasN, porVencer7d,
    programadoMxn, programadoUsd, programadoN,
  } = useMemo(() => {
    let porPagarMxn = 0, porPagarUsd = 0, vencidasN = 0, porVencer7d = 0;
    let programadoMxn = 0, programadoUsd = 0, programadoN = 0;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const en7d = new Date(hoy); en7d.setDate(en7d.getDate() + 7);
    for (const f of data) {
      if (f.saldo <= 0) continue;
      if (f.moneda === "USD") porPagarUsd++; else porPagarMxn++;
      if (f.estatus === "Vencida") vencidasN++;
      if (f.estatus === "Por vencer") porVencer7d++;
      if (f.fecha_programada_pago) {
        const fp = new Date(`${f.fecha_programada_pago}T00:00:00`);
        if (fp >= hoy && fp <= en7d) {
          programadoN++;
          if (f.moneda === "USD") programadoUsd += f.saldo; else programadoMxn += f.saldo;
        }
      }
    }
    return { porPagarMxn, porPagarUsd, vencidasN, porVencer7d, programadoMxn, programadoUsd, programadoN };
  }, [data]);
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
        sublabel={`${formatCurrency(kpis.por_vencer_7d_usd, "USD")} · ${countLabelCorto(porVencer7d)}`}
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


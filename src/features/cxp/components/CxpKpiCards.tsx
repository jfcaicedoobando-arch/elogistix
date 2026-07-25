/**
 * Grid de KPIs para la página CxP. Extraído de Cxp.tsx para mantener el page < 200 líneas.
 */
import { useMemo } from "react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP, KPIsCxP } from "@/features/cxp/services";

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "factura" : "facturas"}`;
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
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
      <KpiCard label="Por pagar MXN" value={formatCurrency(kpis.por_pagar_mxn, "MXN")} sublabel={countLabel(porPagarMxn)} />
      <KpiCard label="Por pagar USD" value={formatCurrency(kpis.por_pagar_usd, "USD")} sublabel={countLabel(porPagarUsd)} />
      <KpiCard
        label={`Vencido · ${countLabel(vencidasN)}`}
        value={formatCurrency(kpis.vencido_mxn, "MXN")}
        sublabel={formatCurrency(kpis.vencido_usd, "USD")}
        variant="destructive"
      />
      <KpiCard
        label={`Por vencer 5d · ${countLabel(porVencer7d)}`}
        value={formatCurrency(kpis.por_vencer_7d_mxn, "MXN")}
        sublabel={formatCurrency(kpis.por_vencer_7d_usd, "USD")}
        variant="warning"
      />
      <KpiCard
        label={`Programado 7d · ${countLabel(programadoN)}`}
        value={formatCurrency(programadoMxn, "MXN")}
        sublabel={formatCurrency(programadoUsd, "USD")}
      />
    </div>
  );
}


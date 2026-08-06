/** KPIs de la bandeja de anticipos a proveedores. */
import { useMemo } from "react";
import { HandCoins, Wallet, CheckCircle2 } from "lucide-react";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import type { AnticipoProveedorRow } from "../../hooks/useAnticiposProveedor";

interface Props {
  anticipos: AnticipoProveedorRow[];
}

function sumaPorMoneda(rows: AnticipoProveedorRow[], campo: (r: AnticipoProveedorRow) => number) {
  const acc = new Map<string, number>();
  for (const r of rows) acc.set(r.moneda, (acc.get(r.moneda) ?? 0) + campo(r));
  return [...acc.entries()]
    .filter(([, v]) => Math.abs(v) > 0.005)
    .map(([moneda, v]) => formatCurrency(v, moneda));
}

export function AnticiposKpis({ anticipos }: Props) {
  const { vigentes, disponible, anticipado, aplicado } = useMemo(() => {
    const vig = anticipos.filter((a) => a.estado !== "cancelado");
    return {
      vigentes: vig,
      disponible: sumaPorMoneda(vig, (a) => a.disponible),
      anticipado: sumaPorMoneda(vig, (a) => Number(a.monto)),
      aplicado: sumaPorMoneda(vig, (a) => a.aplicado),
    };
  }, [anticipos]);

  const pendientes = vigentes.filter((a) => a.disponible > 0).length;

  return (
    <KpiStrip desktopCols={4} className="mb-6">
      <KpiCard
        label="Anticipos por aplicar"
        value={pendientes}
        icon={HandCoins}
        iconVariant="chip"
        sublabel="Con saldo a favor vigente"
      />
      <KpiCard
        label="Saldo a favor disponible"
        value={disponible.length > 0 ? disponible.join(" · ") : "—"}
        icon={Wallet}
        iconVariant="chip"
        variant="accent"
        sublabel="Dinero adelantado sin consumir"
      />
      <KpiCard
        label="Total anticipado"
        value={anticipado.length > 0 ? anticipado.join(" · ") : "—"}
        icon={HandCoins}
        sublabel="Suma de anticipos vigentes"
      />
      <KpiCard
        label="Aplicado a facturas"
        value={aplicado.length > 0 ? aplicado.join(" · ") : "—"}
        icon={CheckCircle2}
        variant="success"
        sublabel="Ya cruzado contra facturas"
      />
    </KpiStrip>
  );
}

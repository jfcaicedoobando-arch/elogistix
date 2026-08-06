/**
 * Sub-componentes del card "Arribos este mes". Extraídos para mantener
 * `ArribosCard.tsx` ≤200 líneas (Power of 10).
 */
import { Fragment } from "react";
import { formatCurrency } from "@/lib/formatters";
import { SectionHeading } from "@/components/shared/SectionHeading";
import type { ArribosEsteMes } from "./ArribosCard";

export function ProfitTooltipContent({ data }: { data: ArribosEsteMes }) {
  const venta = data.ventaMXN;
  const costo = data.costoMXN;
  const profit = data.profitMXN;
  const margenPct = venta > 0 ? (profit / venta) * 100 : 0;
  const profitPositivo = profit >= 0;
  const profitColor = profitPositivo ? "text-success" : "text-destructive";
  const profitBg = profitPositivo ? "bg-success/10" : "bg-destructive/10";
  const total = Math.max(venta, costo + Math.max(profit, 0));
  const costoPct = total > 0 ? Math.min(100, (costo / total) * 100) : 0;
  const profitBarPct = total > 0
    ? Math.min(100 - costoPct, (Math.max(profit, 0) / total) * 100)
    : 0;
  const desglose = [
    { label: "USD", v: data.ventaMxnFromUsd, c: data.costoMxnFromUsd },
    { label: "EUR", v: data.ventaMxnFromEur, c: data.costoMxnFromEur },
    { label: "MXN", v: data.ventaMxnNative, c: data.costoMxnNative },
  ].filter((r) => r.v !== 0 || r.c !== 0);

  return (
    <div className="space-y-3">
      <div>
        <SectionHeading as="h3">Profit proyectado del mes</SectionHeading>
        <div className="text-2xs text-muted-foreground uppercase tracking-wide mt-0.5">
          Homologado a MXN
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Venta total</span>
        <span className="tabular-nums font-medium text-right">{formatCurrency(venta, "MXN")}</span>
        <span className="text-muted-foreground">Costo total</span>
        <span className="tabular-nums font-medium text-right">{formatCurrency(costo, "MXN")}</span>
      </div>

      <div className={`rounded-md px-2.5 py-2 ${profitBg}`}>
        <div className="grid grid-cols-[1fr_auto] gap-x-3 items-baseline">
          <span className="text-xs font-semibold">
            Profit
            <span className="ml-1.5 text-2xs font-normal text-muted-foreground tabular-nums">
              ({margenPct.toFixed(1)}%)
            </span>
          </span>
          <span className={`text-base font-bold tabular-nums text-right ${profitColor}`}>
            {formatCurrency(profit, "MXN")}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
          <div className="h-full bg-warning" style={{ width: `${costoPct}%` }} />
          <div
            className={`h-full ${profitPositivo ? "bg-success" : "bg-destructive"}`}
            style={{ width: `${profitBarPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-3xs text-muted-foreground uppercase tracking-wide">
          <span>Costo</span>
          <span>{profitPositivo ? "Profit" : "Pérdida"}</span>
        </div>
      </div>

      {desglose.length > 0 && (
        <div className="border-t pt-2">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground mb-1">
            Desglose por moneda origen
          </div>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-0.5 text-label">
            <span className="text-2xs uppercase text-muted-foreground">Origen</span>
            <span className="text-2xs uppercase text-muted-foreground text-right">Venta MXN</span>
            <span className="text-2xs uppercase text-muted-foreground text-right">Costo MXN</span>
            {desglose.map((r) => (
              <Fragment key={r.label}>
                <span className="font-medium">{r.label}</span>
                <span className="tabular-nums text-right">{formatCurrency(r.v, "MXN")}</span>
                <span className="tabular-nums text-right text-muted-foreground">{formatCurrency(r.c, "MXN")}</span>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      <div className="text-2xs text-muted-foreground italic border-t pt-1.5">
        Conversión con TC guardado en cada embarque.
      </div>
    </div>
  );
}

interface CoberturaProps {
  profitMXN: number;
  gastos: number;
  faltante: number;
  sinGastos: boolean;
  perdida: boolean;
  pctReal: number;
}

export function CoberturaTooltipContent({
  profitMXN, gastos, faltante, sinGastos, perdida, pctReal,
}: CoberturaProps) {
  return (
    <div className="space-y-2">
      <SectionHeading as="h3">Cobertura de gastos fijos</SectionHeading>
      <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">Profit proyectado</span>
        <span className="tabular-nums font-medium text-right">{formatCurrency(profitMXN, "MXN")}</span>
        <span className="text-muted-foreground">Gastos fijos del mes</span>
        <span className="tabular-nums font-medium text-right">{formatCurrency(gastos, "MXN")}</span>
      </div>
      {sinGastos ? (
        <p className="text-label text-muted-foreground italic border-t pt-1.5">
          Aún no hay gastos fijos capturados este mes.
        </p>
      ) : perdida ? (
        <p className="text-label text-destructive border-t pt-1.5">
          Pérdida proyectada: aún no cubres nada de los gastos fijos.
        </p>
      ) : pctReal >= 100 ? (
        <p className="text-label text-success border-t pt-1.5">
          Ya cubriste tus gastos fijos del mes. El excedente es utilidad neta.
        </p>
      ) : (
        <p className="text-label text-muted-foreground border-t pt-1.5">
          Faltan <span className="font-semibold text-foreground">{formatCurrency(faltante, "MXN")}</span> de profit para cubrir tus gastos fijos.
        </p>
      )}
      <p className="text-2xs text-muted-foreground italic">
        Gastos fijos = facturas con categoría <strong>Indirecto de operación</strong> o <strong>Administración</strong> + comisiones del mes.
      </p>
    </div>
  );
}

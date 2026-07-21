/**
 * `<FacturaContextoBand />` — banda de contexto reutilizable para modales de CxP.
 *
 * Encapsula el design language "Card grid estructurada" (v13.303.94):
 *   1. Chip-folio inline (folio interno mono/uppercase) + meta muted.
 *   2. Banda de estado (dot de aprobación + aviso de vencida/cancelada).
 *   3. KPI grid con `emphasis` en la métrica dominante (Total o Saldo).
 *
 * Variantes:
 *   - `full`     → chip + banda + 4 KPIs (Total, Pagado, Saldo, Moneda).
 *   - `compact`  → chip + banda + 3 KPIs (sin Pagado). Ideal para confirmaciones.
 */
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { EstadoAprobacionDot } from "./EstadoAprobacionDot";

export type FacturaContextoEmphasis = "total" | "saldo" | null;
export type FacturaContextoVariant = "full" | "compact";

interface Props {
  factura: FacturaCxP;
  variant?: FacturaContextoVariant;
  emphasis?: FacturaContextoEmphasis;
}

export function FacturaContextoBand({ factura, variant = "full", emphasis = "saldo" }: Props) {
  const vencida = factura.dias_vencido > 0 && factura.saldo > 0.01;
  const cancelada = factura.estado === "Cancelada";
  const moneda = factura.moneda;
  const tcInfo = factura.tipo_cambio_usd > 0 && moneda !== "MXN"
    ? `${moneda} · TC ${factura.tipo_cambio_usd.toFixed(2)}`
    : moneda;

  return (
    <div className="space-y-3 -mt-1">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider border">
          {factura.folio_interno}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          Folio prov. <span className="font-mono">{factura.folio_proveedor}</span> · {factura.proveedor_nombre}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap px-3 py-2 rounded-md bg-accent/5 border">
        <EstadoAprobacionDot estado={factura.estado_aprobacion} cancelada={cancelada} />
        {vencida && (
          <>
            <span className="h-4 w-px bg-border" aria-hidden />
            <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
              Vencida · {factura.dias_vencido} d
            </span>
          </>
        )}
      </div>

      <div className={variant === "full"
        ? "grid grid-cols-2 md:grid-cols-4 gap-2.5"
        : "grid grid-cols-3 gap-2.5"
      }>
        <Kpi
          label="Total"
          value={formatCurrency(factura.total, moneda)}
          emphasis={emphasis === "total"}
        />
        {variant === "full" && (
          <Kpi label="Pagado" value={formatCurrency(factura.pagado, moneda)} tone="success" />
        )}
        <Kpi
          label="Saldo pendiente"
          value={formatCurrency(factura.saldo, moneda)}
          tone={factura.saldo > 0.01 ? "warn" : "default"}
          emphasis={emphasis === "saldo"}
        />
        <Kpi label="Moneda" value={tcInfo} />
      </div>
    </div>
  );
}

/**
 * `<EstadoFacturaCxPCell />` — Chip primario + chips secundarios para la
 * columna "Estado" de la tabla de facturas de proveedor (`/compras/facturas`).
 *
 * Reemplaza las columnas paralelas "Estatus", "Aprobación", "Días" y
 * "Prog. pago" — la información se consolida aquí sin perder señal:
 *
 *   Estado primario (uno)   → StatusBadge (registry)
 *   Chips secundarios (0..N) → Parcial · +N d · NC · SAT validado · Prog. DD/MM
 *
 * Un único Tooltip agrupa el detalle: motivo de rechazo, sub-tipo de
 * cancelación (SAT vs manual), saldo, días vencido y NC aplicadas.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Badge } from "@/components/ui/badge";
import { CHIP_BASE } from "@/lib/ui/badgeTone";
import type { ChipTone } from "@/lib/ui/badgeTone";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
const fmtMoney = (n: number, currency: string) => formatCurrency(n, currency);
import { motivoSatNoAplica } from "@/features/cxp/domain/validacionSat";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
  /**
   * `tabla` (por omisión) muestra el badge primario + chips secundarios.
   * `detalle` muestra sólo el badge primario: en la página de detalle esa
   * información ya vive en el stepper, la cinta de KPIs y las pestañas.
   */
  variant?: "tabla" | "detalle";
}


function formatProgramada(iso: string): string {
  return formatFechaEs(iso, { day: "2-digit", month: "2-digit" });
}

function tooltipDetails(f: FacturaCxP): string[] {
  const lines: string[] = [];
  if (f.estatus === "Rechazada" && f.motivo_rechazo) {
    lines.push(`Motivo del rechazo: ${f.motivo_rechazo}`);
  }
  if (f.flags.canceladaPor === "sat") {
    lines.push("Cancelada por el SAT.");
  } else if (f.flags.canceladaPor === "manual") {
    lines.push("Cancelada manualmente.");
    if (f.motivo_cancelacion) lines.push(`Motivo: ${f.motivo_cancelacion}`);
  }
  if (f.estatus === "Vencida") {
    lines.push(`Con ${f.dias_vencido} día${f.dias_vencido === 1 ? "" : "s"} de atraso.`);
  }
  if (f.flags.parcial) {
    lines.push(
      `Pago parcial: ${fmtMoney(f.pagado, f.moneda)} de ${fmtMoney(f.total, f.moneda)} (${f.flags.parcialPct}%).`,
    );
  }
  if (f.flags.ncAplicada) {
    lines.push(`Nota(s) de crédito aplicada(s): ${fmtMoney(f.notas_credito, f.moneda)}.`);
  }
  const satNoAplica = motivoSatNoAplica(f);
  if (satNoAplica) {
    lines.push(satNoAplica);
  }
  if (f.flags.satVerificada && f.uuid_verificado_fecha) {
    const fecha = formatFechaEs(f.uuid_verificado_fecha);
    lines.push(`CFDI verificado en SAT el ${fecha}.`);
  }
  if (f.fecha_programada_pago && f.estatus !== "Pagada") {
    lines.push(`Pago programado para el ${formatProgramada(f.fecha_programada_pago)}.`);
  }
  if (lines.length === 0) lines.push(`Saldo: ${fmtMoney(f.saldo, f.moneda)}.`);
  return lines;
}

export function EstadoFacturaCxPCell({ factura: f, variant = "tabla" }: Props) {
  if (variant === "detalle") {
    return <StatusBadge domain="factura_cxp" status={f.estatus} />;
  }

  const chips: Array<{ key: string; label: string; tone: ChipTone }> = [];

  if (f.flags.parcial) {
    chips.push({ key: "parcial", label: `Parcial · ${f.flags.parcialPct}%`, tone: "info" });
  }
  if (f.estatus === "Vencida" && f.dias_vencido > 0) {
    chips.push({ key: "vencida-dias", label: `+${f.dias_vencido} d`, tone: "destructive" });
  }
  if (f.flags.ncAplicada) {
    chips.push({ key: "nc", label: "NC", tone: "neutral" });
  }
  if (f.flags.satVerificada) {
    chips.push({ key: "sat", label: "SAT validado", tone: "success" });
  } else if (motivoSatNoAplica(f)) {
    chips.push({ key: "sat-na", label: "SAT: No aplica", tone: "neutral" });
  }
  if (f.fecha_programada_pago && f.estatus !== "Pagada" && f.estatus !== "Cancelada") {
    chips.push({
      key: "programado",
      label: `Prog. ${formatProgramada(f.fecha_programada_pago)}`,
      tone: "warning",
    });
  }

  // v13.308.2 — Hasta 5 chips visibles (Parcial · +N d · NC · SAT validado · Prog.),
  // el resto colapsa en un chip "+N". Antes eran 3 y se ocultaban SAT/Prog.
  const VISIBLE = 5;
  const overflow = Math.max(0, chips.length - VISIBLE);
  const shown = chips.slice(0, VISIBLE);

  const details = tooltipDetails(f);

  return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-testid="cxp-estado-cell"
            className="flex flex-col items-start gap-1 min-w-0"
          >
            <StatusBadge domain="factura_cxp" status={f.estatus} />
            {shown.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {shown.map((c) => (
                  <ToneBadge key={c.key} tone={c.tone}>{c.label}</ToneBadge>
                ))}
                {overflow > 0 && (
                  <Badge variant="outline" className={CHIP_BASE}>
                    +{overflow}
                  </Badge>
                )}
              </div>
            )}

          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <ul className="space-y-0.5 text-body-sm">
            {details.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
  );
}

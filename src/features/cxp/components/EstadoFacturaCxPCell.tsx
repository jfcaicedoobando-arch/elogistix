/**
 * `<EstadoFacturaCxPCell />` — Chip primario + chips secundarios para la
 * columna "Estado" de la tabla de facturas de proveedor (`/compras/facturas`).
 *
 * Reemplaza las columnas paralelas "Estatus", "Aprobación", "Días" y
 * "Prog. pago" — la información se consolida aquí sin perder señal:
 *
 *   Estado primario (uno)   → StatusBadge (registry)
 *   Chips secundarios (0..N) → Parcial · +N d · NC · SAT ✓ · Prog. DD/MM
 *
 * Un único Tooltip agrupa el detalle: motivo de rechazo, sub-tipo de
 * cancelación (SAT vs manual), saldo, días vencido y NC aplicadas.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
const fmtMoney = (n: number, currency: string) => formatCurrency(n, currency);
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
}

const CHIP_BASE = "text-2xs px-1.5 py-0 h-4 font-normal leading-none";

function formatProgramada(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
  });
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
  if (f.flags.satVerificada && f.uuid_verificado_fecha) {
    const fecha = new Date(f.uuid_verificado_fecha).toLocaleDateString("es-MX");
    lines.push(`CFDI verificado en SAT el ${fecha}.`);
  }
  if (f.fecha_programada_pago && f.estatus !== "Pagada") {
    lines.push(`Pago programado para el ${formatProgramada(f.fecha_programada_pago)}.`);
  }
  if (lines.length === 0) lines.push(`Saldo: ${fmtMoney(f.saldo, f.moneda)}.`);
  return lines;
}

export function EstadoFacturaCxPCell({ factura: f }: Props) {
  const chips: Array<{ key: string; label: string; className: string; title?: string }> = [];

  if (f.flags.parcial) {
    chips.push({
      key: "parcial",
      label: `Parcial · ${f.flags.parcialPct}%`,
      className: "bg-info/10 text-info border-info/20 tabular-nums",
    });
  }
  if (f.estatus === "Vencida" && f.dias_vencido > 0) {
    chips.push({
      key: "vencida-dias",
      label: `+${f.dias_vencido} d`,
      className: "bg-destructive/10 text-destructive border-destructive/30 tabular-nums",
    });
  }
  if (f.flags.ncAplicada) {
    chips.push({
      key: "nc",
      label: "NC",
      className: "bg-primary/10 text-primary border-primary/20",
    });
  }
  if (f.flags.satVerificada) {
    chips.push({
      key: "sat",
      label: "SAT ✓",
      className: "bg-success/10 text-success border-success/30",
    });
  }
  if (f.fecha_programada_pago && f.estatus !== "Pagada" && f.estatus !== "Cancelada") {
    chips.push({
      key: "programado",
      label: `Prog. ${formatProgramada(f.fecha_programada_pago)}`,
      className: "bg-warning/10 text-warning border-warning/30 tabular-nums",
    });
  }

  const details = tooltipDetails(f);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-testid="cxp-estado-cell"
            className="flex flex-col items-start gap-1 min-w-0"
          >
            <StatusBadge domain="factura_cxp" status={f.estatus} />
            {chips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {chips.map((c) => (
                  <Badge
                    key={c.key}
                    variant="outline"
                    className={`${CHIP_BASE} ${c.className}`}
                  >
                    {c.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <ul className="space-y-0.5 text-xs">
            {details.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

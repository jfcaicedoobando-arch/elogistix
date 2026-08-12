/**
 * Fila del reparto del cobro en lote de cliente.
 * Se extrae de `DialogCobroLoteRenglones` para respetar el límite de líneas y
 * concentrar las ayudas visuales (vencimiento, REP, error por renglón).
 */
import { FileText } from "lucide-react";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { diasHastaFecha } from "@/lib/date/dateOnly";
import { cn } from "@/lib/utils";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

interface Props {
  factura: FacturaCobroCandidata;
  monto: number;
  moneda: string;
  impar: boolean;
  error?: string;
  requiereRep: boolean;
  onMontoChange: (monto: number) => void;
  onAsignarSaldo: () => void;
}

/** Chip de vencimiento: justifica el orden FIFO del reparto. */
function ChipVencimiento({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-xs text-muted-foreground">Sin fecha</span>;
  const dias = diasHastaFecha(iso);
  const vencida = dias < 0;
  const texto =
    dias === 0 ? "Vence hoy" : vencida ? `Vencida ${Math.abs(dias)} d` : `Vence en ${dias} d`;
  return (
    <div className="leading-tight">
      <p className="text-xs text-muted-foreground">{formatDate(iso)}</p>
      <p className={cn("text-[11px]", vencida ? "text-destructive" : "text-muted-foreground")}>
        {texto}
      </p>
    </div>
  );
}

export function CobroLoteRenglon(p: Props) {
  const queda = Math.max(0, Math.round((p.factura.saldo - p.monto) * 100) / 100);
  const liquidada = p.monto > 0 && queda <= 0.009;
  const parcial = p.monto > 0 && !liquidada;

  return (
    <tr className={cn("border-t align-top", p.impar && "bg-muted/20", p.error && "bg-destructive/5")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs">{p.factura.numero ?? "—"}</span>
          {p.requiereRep && (
            <Tooltip>
              <TooltipTrigger asChild>
                <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              </TooltipTrigger>
              <TooltipContent>
                Requiere complemento de pago (REP): se timbrará automáticamente.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <ChipVencimiento iso={p.factura.fecha_vencimiento} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatCurrency(p.factura.saldo, p.moneda)}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-end gap-1.5">
          <MoneyInput
            className={cn("h-9 w-full max-w-[140px] text-right", p.error && "border-destructive")}
            value={p.monto === 0 ? null : p.monto}
            currency={p.moneda}
            aria-label={`Importe aplicado a la factura ${p.factura.numero ?? ""}`}
            aria-invalid={!!p.error}
            onChange={(n: number) => p.onMontoChange(n)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={p.onAsignarSaldo}
            title="Asignar el saldo de esta factura"
          >
            Saldo
          </Button>
        </div>
        {p.error && <p className="mt-1 text-right text-[11px] text-destructive">{p.error}</p>}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {liquidada && <Badge variant="outline" className="text-2xs">Liquidada</Badge>}
          {parcial && <Badge variant="secondary" className="text-2xs">Parcial</Badge>}
          <span className="tabular-nums text-muted-foreground">
            {formatCurrency(queda, p.moneda)}
          </span>
        </div>
      </td>
    </tr>
  );
}

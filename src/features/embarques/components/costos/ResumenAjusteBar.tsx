/**
 * Resumen superior de la card "Costos directos": 3 tiles por moneda
 * (Cotizado / Facturado / Ajuste neto) con lenguaje narrativo.
 */
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { describirAjusteNeto } from "./ajusteDescripcion";
import { TONE_TEXT } from "@/lib/ui/badgeTone";

interface TotalPorMoneda {
  moneda: string;
  cotizado: number;
  facturado: number;
}

interface Props {
  totales: TotalPorMoneda[];
}

export function ResumenAjusteBar({ totales }: Props) {
  if (totales.length === 0) return null;
  return (
    <div className="space-y-2">
      {totales.map((t) => {
        const d = describirAjusteNeto(t.cotizado, t.facturado, t.moneda);
        return (
          <div
            key={t.moneda}
            className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2"
          >
            <Tile label={`Cotizado · ${t.moneda}`} value={formatCurrency(t.cotizado, t.moneda)} />
            <Tile label={`Facturado · ${t.moneda}`} value={formatCurrency(t.facturado, t.moneda)} />
            <Tile
              label="Ajuste neto"
              value={`${d.icono} ${d.titulo}`}
              valueClassName={cn("font-semibold", TONE_TEXT[d.tone])}
              title={d.detalle}
            />
          </div>
        );
      })}
    </div>
  );
}

function Tile({
  label, value, valueClassName, title,
}: { label: string; value: string; valueClassName?: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
      <p className={cn("text-sm tabular-nums truncate", valueClassName ?? "font-medium")}>{value}</p>
    </div>
  );
}

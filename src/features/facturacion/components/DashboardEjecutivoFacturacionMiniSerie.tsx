/**
 * Mini-tendencia (barras + iniciales de mes) usada por
 * `DashboardEjecutivoFacturacion`. Extraída para respetar el límite
 * Power of 10 (≤200 líneas por archivo).
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function mesLabel(ymStr: string): string {
  const [, m] = ymStr.split("-");
  const idx = Number.parseInt(m, 10) - 1;
  return NOMBRES_MES[idx] ?? ymStr;
}

interface Props {
  titulo: string;
  data: number[];
  meses: string[];
  colorClass: string;
}

export function MiniSerie({ titulo, data, meses, colorClass }: Props) {
  const max = Math.max(0, ...data);
  const hayDatos = max > 0;
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="text-2xs text-muted-foreground uppercase tracking-wide">{titulo}</div>
      {hayDatos ? (
        <>
          <div className="flex items-end gap-1 h-6">
            {data.map((v, i) => {
              const h = Math.max(2, Math.round((v / max) * 24));
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className={`w-2.5 rounded-sm ${colorClass}`} style={{ height: `${h}px` }} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {meses[i]}: {formatCurrency(v, "MXN")}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex gap-1">
            {meses.map((m, i) => (
              <span key={i} className="w-2.5 text-center text-[8px] text-muted-foreground leading-none">
                {m.charAt(0)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="h-6 flex items-center text-2xs italic text-muted-foreground">Sin datos</div>
      )}
    </div>
  );
}

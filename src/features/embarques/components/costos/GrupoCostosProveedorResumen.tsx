import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TONE_TEXT } from "@/lib/ui/badgeTone";
import type { describirAjusteNeto } from "./ajusteDescripcion";
import { etiquetaConteos } from "./grupoCostosProveedorHelpers";

interface Props {
  resumen: Array<{ moneda: string; d: ReturnType<typeof describirAjusteNeto> }>;
  subtotales: Array<{ moneda: string; cotizado: number; facturado: number }>;
  conAjuste: number;
  sinFactura: number;
}

export function GrupoCostosProveedorResumen({ resumen, subtotales, conAjuste, sinFactura }: Props) {
  const conteos = etiquetaConteos(conAjuste, sinFactura);
  return (
    <TooltipProvider delayDuration={200}>
      <div className="hidden items-center gap-3 text-body-sm tabular-nums shrink-0 sm:flex">
        {resumen.map(({ moneda, d }) => (
          <Tooltip key={moneda}>
            <TooltipTrigger asChild>
              <span className={cn("flex items-center gap-1.5 cursor-help", TONE_TEXT[d.tone])}>
                <span aria-hidden>{d.icono}</span>
                <span className="font-medium">{d.titulo}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{moneda}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-body-sm">
              <div>Cotizado: {formatCurrency(subtotales.find((s) => s.moneda === moneda)?.cotizado ?? 0, moneda)}</div>
              <div>Facturado: {formatCurrency(subtotales.find((s) => s.moneda === moneda)?.facturado ?? 0, moneda)}</div>
              <div className="mt-1">{d.detalle}</div>
            </TooltipContent>
          </Tooltip>
        ))}
        {conteos && <span className="text-muted-foreground">{conteos}</span>}
      </div>
    </TooltipProvider>
  );
}
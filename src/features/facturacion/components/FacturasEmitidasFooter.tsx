/**
 * Footer totalizador para la tabla de facturas emitidas.
 *
 * Suma sobre el conjunto FILTRADO (todas las páginas) en moneda original.
 * Excluye canceladas para alinearse con el KPI "Facturado mes" del header.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { sumarFacturasPorMoneda, type FacturaSumable } from "@/features/facturacion/utils/sumarFacturas";

interface Props {
  facturas: FacturaSumable[];
}

export function FacturasEmitidasFooter({ facturas }: Props) {
  const r = sumarFacturasPorMoneda(facturas);
  if (r.conteo === 0 && r.conteoCanceladas === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span className="font-medium">Totales del filtro</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span role="button" tabIndex={0} className="inline-flex" aria-label="Detalle de totales">
                  <Info className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                Suma de TODAS las facturas que cumplen los filtros actuales
                (no sólo la página visible), separadas por moneda y excluyendo
                las canceladas. Para cuadrar contra "Facturado mes" del header,
                aplica el preset <strong>Este mes</strong>.
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Facturas</span>
            <span className="font-semibold tabular-nums">{r.conteo}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal MXN</span>
            <span className="font-semibold tabular-nums">{formatCurrency(r.totalMxn, "MXN")}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal USD</span>
            <span className="font-semibold tabular-nums">{formatCurrency(r.totalUsd, "USD")}</span>
          </div>

          {r.conteoCanceladas > 0 && (
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Canceladas (excluidas)</span>
              <span className="font-semibold tabular-nums text-muted-foreground">{r.conteoCanceladas}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

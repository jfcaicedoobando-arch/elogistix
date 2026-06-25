/**
 * Footer totalizador para la tabla de facturas emitidas.
 *
 * Suma sobre el conjunto FILTRADO (todas las páginas) en moneda original
 * + un MXN equivalente que cuadra contra el KPI "Facturado mes" del header
 * cuando el filtro está en "Este mes".
 */
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { sumarFacturasPorMoneda, type FacturaSumable } from "@/features/facturacion/utils/sumarFacturas";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";

interface Props {
  facturas: FacturaSumable[];
}

export function FacturasEmitidasFooter({ facturas }: Props) {
  const { data: tc } = useExchangeRates();
  const fallbackUsdMxn = tc?.usdMxn ?? null;
  const r = sumarFacturasPorMoneda(facturas, { fallbackUsdMxn });
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
              <TooltipContent side="top" className="max-w-[300px] text-xs">
                Suma de TODAS las facturas que cumplen los filtros actuales
                (no sólo la página visible), separadas por moneda y excluyendo
                las canceladas. El <strong>MXN equivalente</strong> usa el tipo
                de cambio de cada factura o el TC del día como fallback — es el
                número que cuadra contra "Facturado mes" del header.
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

          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              MXN equivalente
            </span>
            <span className="font-semibold tabular-nums text-primary">
              {formatCurrency(r.mxnEquivalente, "MXN")}
            </span>
          </div>

          {r.facturasSinTc > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col cursor-help">
                  <span className="text-[11px] uppercase tracking-wide text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Sin TC
                  </span>
                  <span className="font-semibold tabular-nums text-warning">{r.facturasSinTc}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs">
                {r.facturasSinTc} factura(s) USD sin tipo de cambio capturado
                y sin TC del día disponible. No se incluyen en el MXN equivalente.
              </TooltipContent>
            </Tooltip>
          )}

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

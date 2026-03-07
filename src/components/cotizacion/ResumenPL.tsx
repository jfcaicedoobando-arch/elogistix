import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ProfitBadge, RentabilidadGlobalBadge } from "@/lib/profitUtils";

interface TotalesMoneda {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

interface Props {
  totalesUSD: TotalesMoneda;
  totalesMXN: TotalesMoneda;
  tieneUSD: boolean;
  tieneMXN: boolean;
  /** Mostrar badge de rentabilidad global (modo local) */
  mostrarRentabilidadGlobal?: boolean;
  /** Nota al pie opcional */
  notaPie?: string;
}

export default function ResumenPL({
  totalesUSD, totalesMXN, tieneUSD, tieneMXN,
  mostrarRentabilidadGlobal = false, notaPie,
}: Props) {
  if (!tieneUSD && !tieneMXN) return null;

  const renderCard = (moneda: "USD" | "MXN", totales: TotalesMoneda) => (
    <Card className="border-violet-100">
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-semibold text-violet-600">{moneda}</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Costo</span>
          <span>{formatCurrency(totales.totalCosto, moneda)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Venta</span>
          <span>{formatCurrency(totales.totalVenta, moneda)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>Profit</span>
          <span className={totales.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
            {formatCurrency(totales.profit, moneda)}
          </span>
        </div>
        <div className="flex justify-center pt-1">
          <ProfitBadge porcentaje={totales.porcentaje} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              Resumen P&L
              <div className="ml-auto flex items-center gap-2">
                {mostrarRentabilidadGlobal && (
                  <RentabilidadGlobalBadge
                    porcentajeUSD={totalesUSD.porcentaje}
                    porcentajeMXN={totalesMXN.porcentaje}
                    tieneUSD={tieneUSD}
                    tieneMXN={tieneMXN}
                  />
                )}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tieneUSD && renderCard("USD", totalesUSD)}
              {tieneMXN && renderCard("MXN", totalesMXN)}
            </div>
            {notaPie && (
              <p className="text-xs text-muted-foreground mt-3">* {notaPie}</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

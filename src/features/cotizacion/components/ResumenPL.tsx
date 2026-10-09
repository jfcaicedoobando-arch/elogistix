import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { resumirUtilidadCotizacion } from "@/features/cotizacion/domain/resumenUtilidadCotizacion";
import { ProfitBadge, RentabilidadGlobalBadge } from "@/features/cotizacion/components/ProfitBadge";

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
  conceptosVenta?: ConceptoVentaCotizacion[];
  conceptosDescartados?: number;
  sinCostosRegistrados?: boolean;
  /** Mostrar badge de rentabilidad global (modo local) */
  mostrarRentabilidadGlobal?: boolean;
  /** Nota al pie opcional */
  notaPie?: string;
}

function margenDefinido(tieneMoneda: boolean, venta: number): boolean {
  return !tieneMoneda || venta > 0;
}

export default function ResumenPL({
  totalesUSD: costoUSD, totalesMXN: costoMXN, tieneUSD: costosUSD, tieneMXN: costosMXN,
  mostrarRentabilidadGlobal = false, notaPie, conceptosVenta, conceptosDescartados, sinCostosRegistrados,
}: Props) {
  const resumen = resumirUtilidadCotizacion(costoUSD, costoMXN, conceptosVenta, { conceptosDescartados, sinCostosRegistrados });
  if (!resumen.ok) return (
    <Card><CardHeader><CardTitle>Resumen de utilidad</CardTitle></CardHeader>
      <CardContent><p role="status" className="text-body-sm text-muted-foreground">{resumen.mensaje}</p></CardContent>
    </Card>
  );
  const { totalesUSD, totalesMXN } = resumen;
  const tieneUSD = costosUSD || resumen.tieneVentaUSD;
  const tieneMXN = costosMXN || resumen.tieneVentaMXN;
  if (!tieneUSD && !tieneMXN) return null;

  const renderCard = (moneda: "USD" | "MXN", totales: TotalesMoneda) => (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-2">
        <p className="text-body font-semibold text-primary">{moneda}</p>
        <div className="flex justify-between text-body">
          <span className="text-muted-foreground">Costo total</span>
          <span className="tabular-nums">{formatCurrency(totales.totalCosto, moneda)}</span>
        </div>
        <div className="flex justify-between text-body">
          <span className="text-muted-foreground">Venta total</span>
          <span className="tabular-nums">{formatCurrency(totales.totalVenta, moneda)}</span>

        </div>
        <div className="flex justify-between text-body font-semibold">
          <span>Utilidad</span>
          <span className={totales.profit >= 0 ? "text-success" : "text-destructive"}>
            {formatCurrency(totales.profit, moneda)}
          </span>
        </div>
        <div className="flex justify-center pt-1">
          <ProfitBadge porcentaje={totales.porcentaje} venta={totales.totalVenta} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Resumen de utilidad
              <div className="ml-auto flex items-center gap-2">
                {mostrarRentabilidadGlobal && margenDefinido(tieneUSD, totalesUSD.totalVenta) && margenDefinido(tieneMXN, totalesMXN.totalVenta) && (
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
            {conceptosVenta && resumen.usaCosteo && (
              <p className="text-body-sm text-muted-foreground mt-3">Sin conceptos de venta: se muestra la estimación del costeo.</p>
            )}
            {notaPie && (
              <p className="text-body-sm text-muted-foreground mt-3">* {notaPie}</p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

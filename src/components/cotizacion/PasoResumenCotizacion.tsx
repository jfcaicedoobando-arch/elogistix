import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ProfitBadge } from "@/lib/profitUtils";

interface TotalesPL {
  totalCosto: number;
  totalVenta: number;
  profit: number;
  porcentaje: number;
}

interface Props {
  plUSD: TotalesPL;
  plMXN: TotalesPL;
  tieneCostosUSD: boolean;
  tieneCostosMXN: boolean;
  nombreCliente: string;
  origen: string;
  destino: string;
  numContenedores: number;
  modo: string;
  incoterm: string;
  tipo: string;
  totalUSD: number;
  totalMXN: number;
}

export default function PasoResumenCotizacion({
  plUSD, plMXN, tieneCostosUSD, tieneCostosMXN,
  nombreCliente, origen, destino, numContenedores,
  modo, incoterm, tipo, totalUSD, totalMXN,
}: Props) {
  return (
    <div className="space-y-4">
      {/* P&L Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tieneCostosUSD && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">P&L USD</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Costo</span>
                <span>{formatCurrency(plUSD.totalCosto, "USD")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Venta</span>
                <span>{formatCurrency(plUSD.totalVenta, "USD")}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Profit</span>
                <span className={plUSD.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {formatCurrency(plUSD.profit, "USD")}
                </span>
              </div>
              <div className="flex justify-center pt-1"><ProfitBadge porcentaje={plUSD.porcentaje} /></div>
            </CardContent>
          </Card>
        )}
        {tieneCostosMXN && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">P&L MXN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Costo</span>
                <span>{formatCurrency(plMXN.totalCosto, "MXN")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Venta</span>
                <span>{formatCurrency(plMXN.totalVenta, "MXN")}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Profit</span>
                <span className={plMXN.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                  {formatCurrency(plMXN.profit, "MXN")}
                </span>
              </div>
              <div className="flex justify-center pt-1"><ProfitBadge porcentaje={plMXN.porcentaje} /></div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Datos de operación */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Datos de la Operación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente</span>
              <p className="font-medium">{nombreCliente || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ruta</span>
              <p className="font-medium">{origen || '—'} → {destino || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Contenedores/BLs</span>
              <p className="font-medium">{numContenedores}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Modo</span>
              <p className="font-medium">{modo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Incoterm</span>
              <p className="font-medium">{incoterm}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium">{tipo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totales de venta */}
      <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
        <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
        <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-sm">
        <Info className="h-4 w-4 flex-shrink-0" />
        La cotización se guardará en estado Borrador.
      </div>
    </div>
  );
}

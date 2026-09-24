import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { queryKeys } from "@/lib/query";
import { fetchOrigenLclManual } from "@/features/embarques/services/origenLclManual";

/** W/M = mayor entre m³ y toneladas; flete = max(W/M × tarifa, mínimo). */
export function calcularFleteLcl(tarifaWm: number, minimo: number | null, m3: number, kg: number) {
  const wm = Math.max(m3, kg / 1000);
  return { wm, costo: Math.max(wm * tarifaWm, minimo ?? 0) };
}

export function OrigenLclManualCard({ cotizacionId }: { cotizacionId: string }) {
  const { data } = useQuery({
    queryKey: queryKeys.cotizaciones.origenLcl(cotizacionId),
    queryFn: () => fetchOrigenLclManual(cotizacionId),
    staleTime: 60_000,
  });
  if (!data || data.tarifaWm == null) return null;
  const { wm, costo } = calcularFleteLcl(data.tarifaWm, data.minimo, Number(data.volumenM3) || 0, Number(data.pesoKg) || 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" />Origen de costos: Tarifa LCL manual</CardTitle>
      </CardHeader>
      <CardContent className="text-body space-y-1">
        <p>Tarifa: {formatCurrency(data.tarifaWm, "USD")}/W/M · Mínimo: {data.minimo != null ? formatCurrency(data.minimo, "USD") : "—"}</p>
        <p>W/M: {formatNumber(wm, { decimals: 2 })} · Flete estimado: {formatCurrency(costo, "USD")}</p>
        <p>Consolidador: {data.consolidador ?? "—"}</p>
        <Link to={`/cotizaciones/${data.cotizacionId}`} className="text-body-sm text-primary underline">
          Ver cotización {data.folio}
        </Link>
      </CardContent>
    </Card>
  );
}

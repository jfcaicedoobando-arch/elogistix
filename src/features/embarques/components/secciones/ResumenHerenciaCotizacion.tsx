/**
 * Resumen de los datos heredados de la cotización vinculada que se
 * persistirán en el embarque pero todavía no tienen UI de edición
 * dedicada en el wizard (Pack B+ v13.33.0).
 *
 * Aparece solo cuando hay cotización vinculada y la cotización trae al menos
 * uno de estos campos definidos. Es read-only: el caller puede editar los
 * valores desde la cotización origen y vincular de nuevo.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import { useCotizacionVinculada } from "@/features/embarques/hooks/useHeredadoCotizacion";
import { formatCurrency } from "@/lib/formatters/numbers";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export function ResumenHerenciaCotizacion() {
  const cot = useCotizacionVinculada();
  if (!cot) return null;

  const tieneAlgo =
    cot.tarifa_id ||
    cot.carta_garantia ||
    (cot.dias_libres_destino ?? 0) > 0 ||
    (cot.dias_almacenaje ?? 0) > 0 ||
    cot.seguro ||
    cot.notas;

  if (!tieneAlgo) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Datos heredados de cotización
          <Badge variant="secondary" className="ml-auto text-[10px]">{cot.folio ?? ""}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {cot.tarifa_id && <Row label="Tarifa marítima vinculada" value="Sí" />}
        {cot.carta_garantia && <Row label="Carta garantía requerida" value="Sí" />}
        {(cot.dias_libres_destino ?? 0) > 0 && (
          <Row label="Días libres demoras" value={`${cot.dias_libres_destino} días`} />
        )}
        {(cot.dias_almacenaje ?? 0) > 0 && (
          <Row label="Días libres almacenaje" value={`${cot.dias_almacenaje} días`} />
        )}
        {cot.seguro && (
          <Row
            label="Seguro"
            value={
              cot.valor_seguro_usd
                ? formatCurrencyUSD(Number(cot.valor_seguro_usd))
                : "Sí"
            }
          />
        )}
        {cot.notas && (
          <Row
            label="Notas"
            value={<span className="text-xs italic max-w-[60%]">{cot.notas}</span>}
          />
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          Estos campos se guardarán automáticamente con el embarque al crearlo.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Pestaña "P&L por Contenedor" (v13.66.14) — modelo CargoWise.
 *
 * Muestra una vista de utilidad por contenedor dentro del mismo embarque.
 * v13.172.18: migrado a `DataTable` (Fase 5 homologación).
 * v13.182.0: `TablaPorMoneda` extraída a `_sections/TablaPnlPorMoneda.tsx`.
 */
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import { useEmbarqueDetalleData } from "@/features/embarques/hooks/useEmbarqueDetalleData";
import { calcularPnlPorContenedor } from "@/features/embarques/services/pnlPorContenedor";
import { TablaPorMoneda } from "./_sections/TablaPnlPorMoneda";

interface Props {
  embarqueId: string;
  expediente: string;
}

export function TabPnlContenedor({ embarqueId, expediente }: Props) {
  const { conceptosVenta, conceptosCosto, isLoading: loadingConceptos } =
    useEmbarqueDetalleData(embarqueId);
  const { data: contenedores = [], isLoading: loadingContenedores } =
    useContenedoresEmbarque(embarqueId);

  const porMoneda = useMemo(
    () =>
      calcularPnlPorContenedor({
        expediente,
        contenedores,
        conceptosVenta: conceptosVenta ?? [],
        conceptosCosto: conceptosCosto ?? [],
      }),
    [expediente, contenedores, conceptosVenta, conceptosCosto],
  );

  const monedas = Object.keys(porMoneda).sort();

  if (loadingConceptos || loadingContenedores) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (contenedores.length === 0 && monedas.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Este embarque no tiene contenedores registrados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-info/30 bg-info/5">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          Modelo CargoWise: 1 embarque = 1 expediente. El sub-expediente
          (ej. <span className="font-mono">{expediente}-01</span>) es sólo
          referencia operativa del contenedor. Los conceptos sin contenedor
          asignado se prorratean en partes iguales (÷N).
        </CardContent>
      </Card>

      {monedas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No hay conceptos de venta ni costo registrados.
          </CardContent>
        </Card>
      ) : (
        monedas.map((moneda) => (
          <TablaPorMoneda
            key={moneda}
            moneda={moneda}
            filas={porMoneda[moneda]}
          />
        ))
      )}
    </div>
  );
}

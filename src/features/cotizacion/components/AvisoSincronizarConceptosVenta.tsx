/**
 * B-081 — Aviso accionable cuando la cotización tiene costos con precio de
 * venta capturado pero `conceptos_venta` en cero (PDF y detalle en $0.00).
 * Permite regenerar los conceptos de venta a partir de los costos guardados.
 */
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useUpdateCotizacion } from "@/features/cotizacion/hooks";
import { buildConceptosFromCostos } from "@/features/cotizacion/domain/cotizacion";
import { costosSinConcepto } from "@/features/cotizacion/domain/cotizacionVentaSync";
import { fromDb } from "@/lib/supabase/cast";
import type { CostoCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";

interface Props {
  cotizacionId: string;
  costos: CostoCotizacion[];
  tasaIva: number;
  /** Se muestra sólo cuando la venta guardada suma 0 pero los costos sí traen venta. */
  visible: boolean;
}

function aFilaLocal(c: CostoCotizacion): FilaCostoLocal {
  return {
    concepto: c.concepto ?? "",
    moneda: c.moneda,
    proveedor: c.proveedor ?? "",
    cantidad: Number(c.cantidad) || 1,
    costo_unitario: Number(c.costo_unitario) || 0,
    precio_venta: Number(c.precio_venta ?? 0) || 0,
    unidad_medida: c.unidad_medida ?? "",
    // Los comentarios del costo viajan al concepto de venta y al PDF.
    notas: c.notas ?? undefined,

  };
}

export function AvisoSincronizarConceptosVenta({ cotizacionId, costos, tasaIva, visible }: Props) {
  const update = useUpdateCotizacion();
  if (!visible) return null;

  const filas = costos.map(aFilaLocal);
  const faltantes = costosSinConcepto(filas);

  const handleSync = async () => {
    if (faltantes.length > 0) {
      notifyError(undefined, {
        title: "Falta capturar el concepto",
        description: `${faltantes.length === 1 ? "1 renglón de costo no tiene" : `${faltantes.length} renglones de costo no tienen`} concepto. Edita los costos y captura el nombre antes de sincronizar.`,
      });
      return;
    }
    const { usd, mxn } = buildConceptosFromCostos(filas, tasaIva);
    const conceptos = [...usd, ...mxn];
    if (conceptos.length === 0) {
      notifyError(undefined, { title: "No hay conceptos que sincronizar" });
      return;
    }
    const subtotalUSD = usd.reduce((s, c) => s + (Number(c.total) || 0), 0);
    try {
      await update.mutateAsync({
        id: cotizacionId,
        data: fromDb({ conceptos_venta: conceptos, subtotal: subtotalUSD }),
      });
      notifySuccess(undefined, { title: "Conceptos de venta sincronizados desde los costos" });
    } catch (err: unknown) {
      notifyError(undefined, {
        title: "No se pudieron sincronizar los conceptos",
        description: getErrorMessage(err),
        error: err,
        method: "SYNC_CONCEPTOS_VENTA_DESDE_COSTOS",
      });
    }
  };

  return (
    <Alert variant="warning" data-testid="aviso-sincronizar-venta">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Los conceptos de venta están en cero</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>
          Los costos tienen precio de venta capturado, pero la cotización quedó con importes en $0.00
          (así se imprimiría el PDF). Puedes regenerar los conceptos de venta desde los costos.
        </p>
        <Button size="sm" variant="outline" onClick={() => void handleSync()} loading={update.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar conceptos de venta desde costos
        </Button>
      </AlertDescription>
    </Alert>
  );
}

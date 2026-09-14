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
import { fetchCotizacionSelloSync } from "@/features/cotizacion/services/updatedAt";
import { derivarSubtotalMoneda } from "@/features/cotizacion/services/derivarSubtotalMoneda";
import type { EstadoCotizacion } from "@/features/cotizacion/services/mutations/estado";
import type { CostoCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";

const ESTADOS_INMUTABLES = new Set<EstadoCotizacion>(["Aceptada", "En operación"]);

interface Props {
  cotizacionId: string;
  costos: CostoCotizacion[];
  tasaIva: number;
  /** Se muestra sólo cuando la venta guardada suma 0 pero los costos sí traen venta. */
  visible: boolean;
  /**
   * v13.823.360 — espejo UI de `useUpdateCotizacion` (SALES): sin la
   * capacidad de escritura el botón fallaba con 42501 para contabilidad y
   * tesorería; se muestra el aviso como texto de sólo lectura.
   */
  puedeSincronizar: boolean;
  /** v13.823.362 — En Aceptada/En operación el trigger rechaza el UPDATE. */
  estadoCotizacion: EstadoCotizacion;
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

export function AvisoSincronizarConceptosVenta({
  cotizacionId, costos, tasaIva, visible, puedeSincronizar, estadoCotizacion,
}: Props) {
  const update = useUpdateCotizacion();
  if (!visible) return null;

  const filas = costos.map(aFilaLocal);
  const faltantes = costosSinConcepto(filas);
  const estadoInmutable = ESTADOS_INMUTABLES.has(estadoCotizacion);

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
    try {
      // N-2: bloqueo optimista. Se lee el sello `updated_at` justo antes de
      // escribir; si otra sesión guardó la cotización en medio, el UPDATE no
      // toca nada y se avisa del conflicto en vez de pisar esos cambios.
      const sello = await fetchCotizacionSelloSync(cotizacionId);
      // v13.823.360 — subtotal+moneda se derivan con la función canónica:
      // suma SIN IVA, incluye los conceptos MXN (antes se perdían y una
      // cotización sólo MXN guardaba subtotal 0) y en mezcla usa el TC
      // CONGELADO de la cotización; sin TC falla cerrado sin tocar la BD.
      // SAFE-CAST: ConceptoVentaPrellenado es un objeto plano JSON-serializable;
      // la firma canónica pide Record<string, unknown> (misma conversión que wizard.ts).
      const conceptosJson = conceptos as unknown as Record<string, unknown>[];
      const { subtotal, moneda } = derivarSubtotalMoneda(
        conceptosJson,
        sello.moneda,
        sello.tipoCambioUsd,
      );
      await update.mutateAsync({
        id: cotizacionId,
        data: fromDb({ conceptos_venta: conceptos, subtotal, moneda }),
        expectedUpdatedAt: sello.updatedAt,
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
          (así se imprimiría el PDF).
          {estadoInmutable
            ? " Esta cotización ya fue aceptada o está en operación; sus importes no pueden modificarse aquí. Para reflejar los cambios crea una nueva versión o usa Re-cotizar."
            : puedeSincronizar
              ? " Puedes regenerar los conceptos de venta desde los costos."
              : " Un usuario de ventas u operación debe regenerar los conceptos de venta desde los costos."}
        </p>
        {puedeSincronizar && !estadoInmutable && (
          <Button size="sm" variant="outline" onClick={() => void handleSync()} loading={update.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar conceptos de venta desde costos
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

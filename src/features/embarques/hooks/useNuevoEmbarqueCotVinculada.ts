import { useCallback, useState } from "react";
import { useCotizacionHydration } from "@/features/embarques/hooks/useCotizacionHydration";
import { type CotizacionRow } from "@/hooks/cotizacion";
import { fetchCotizacionCostosForEmbarque } from "@/services/cotizacion";
import {
  mapConceptosVentaFromCotizacion,
  mapConceptosCostoFromCotizacion,
} from "@/features/embarques/domain/embarqueWizard";

interface Params {
  form: {
    vincularCotizacion: (cot: CotizacionRow) => void;
    desvincularCotizacion: () => void;
  };
  setConceptosVenta: (v: ReturnType<typeof mapConceptosVentaFromCotizacion>) => void;
  setConceptosCosto: (v: ReturnType<typeof mapConceptosCostoFromCotizacion>) => void;
  proveedoresDb: Parameters<typeof mapConceptosCostoFromCotizacion>[1];
  onClearExpediente: () => void;
}

/**
 * Encapsula vinculación + hidratación de conceptos desde una cotización
 * para el wizard "Nuevo embarque".
 */
export function useNuevoEmbarqueCotVinculada({
  form,
  setConceptosVenta,
  setConceptosCosto,
  proveedoresDb,
  onClearExpediente,
}: Params) {
  const [cotizacionVinculada, setCotizacionVinculada] = useState<CotizacionRow | null>(null);

  const hidratarConceptosDesdeCotizacion = useCallback(
    async (cot: CotizacionRow) => {
      const ventas = mapConceptosVentaFromCotizacion(cot);
      if (ventas.length > 0) setConceptosVenta(ventas);

      const costos = await fetchCotizacionCostosForEmbarque(cot.id);
      if (costos.length > 0) {
        setConceptosCosto(mapConceptosCostoFromCotizacion(costos, proveedoresDb));
      }
    },
    [setConceptosVenta, setConceptosCosto, proveedoresDb],
  );

  const handleVincularCotizacion = useCallback(
    (cot: CotizacionRow) => {
      setCotizacionVinculada(cot);
      form.vincularCotizacion(cot);
      void hidratarConceptosDesdeCotizacion(cot);
    },
    [form, hidratarConceptosDesdeCotizacion],
  );

  const handleDesvincularCotizacion = useCallback(() => {
    setCotizacionVinculada(null);
    form.desvincularCotizacion();
    onClearExpediente();
  }, [form, onClearExpediente]);

  useCotizacionHydration({ onPrevincular: handleVincularCotizacion });

  return {
    cotizacionVinculada,
    handleVincularCotizacion,
    handleDesvincularCotizacion,
  };
}

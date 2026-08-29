import { useCallback, useState } from "react";
import { useCotizacionHydration } from "@/features/embarques/hooks/useCotizacionHydration";
import { type CotizacionRow } from "@/features/cotizacion/hooks";
import { fetchCotizacionCostosForEmbarque } from "@/features/cotizacion/services";
import {
  mapConceptosVentaFromCotizacion,
  mapConceptosCostoFromCotizacion,
} from "@/features/embarques/domain/embarqueWizard";
import type { DesvincularOpcion } from "@/features/embarques/components/DesvincularCotizacionDialog";

interface Params {
  form: {
    vincularCotizacion: (cot: CotizacionRow) => void;
    desvincularCotizacion: (modo?: "limpiar" | "conservar" | "solo-conceptos") => void;
  };
  setConceptosVenta: (v: ReturnType<typeof mapConceptosVentaFromCotizacion>) => void;
  setConceptosCosto: (v: ReturnType<typeof mapConceptosCostoFromCotizacion>) => void;
  proveedoresDb: Parameters<typeof mapConceptosCostoFromCotizacion>[1];
  onClearExpediente: () => void;
}

/**
 * Encapsula vinculación + hidratación de conceptos desde una cotización
 * para el wizard "Nuevo embarque".
 *
 * v13.28.0 — Soporta desvinculación con 3 modos (conservar / solo-conceptos /
 * limpiar) para alimentar al `DesvincularCotizacionDialog`.
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

  const handleDesvincularCotizacion = useCallback(
    (opcion: DesvincularOpcion = "limpiar") => {
      setCotizacionVinculada(null);
      form.desvincularCotizacion(opcion);
      if (opcion === "limpiar" || opcion === "solo-conceptos") {
        setConceptosVenta([]);
        setConceptosCosto([]);
      }
      if (opcion === "limpiar") {
        onClearExpediente();
      }
    },
    [form, onClearExpediente, setConceptosVenta, setConceptosCosto],
  );

  useCotizacionHydration({ onPrevincular: handleVincularCotizacion });

  // M-13 (v14-2): restauración de borrador. Vincula la cotización SIN
  // hidratar conceptos — el draft ya trae la captura del usuario y la
  // hidratación la pisaría (race con el fetch de costos).
  const restaurarVinculacion = useCallback(
    (cot: CotizacionRow) => {
      setCotizacionVinculada(cot);
      form.vincularCotizacion(cot);
    },
    [form],
  );

  return {
    cotizacionVinculada,
    handleVincularCotizacion,
    handleDesvincularCotizacion,
    restaurarVinculacion,
  };
}

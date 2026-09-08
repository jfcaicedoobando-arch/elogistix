import { useCallback, useRef, useState } from "react";
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
  // R201-COT-06: sello de la última vinculación pedida. Una hidratación en
  // vuelo que ya no corresponde a la cotización vigente (o se desvinculó)
  // no debe escribir conceptos.
  const vinculacionRef = useRef(0);

  const hidratarConceptosDesdeCotizacion = useCallback(
    async (cot: CotizacionRow, token: number) => {
      const ventas = mapConceptosVentaFromCotizacion(cot);
      if (ventas.length > 0 && vinculacionRef.current === token) setConceptosVenta(ventas);

      const costos = await fetchCotizacionCostosForEmbarque(cot.id);
      if (vinculacionRef.current !== token) return;
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
      const token = ++vinculacionRef.current;
      void hidratarConceptosDesdeCotizacion(cot, token);
    },
    [form, hidratarConceptosDesdeCotizacion],
  );

  const handleDesvincularCotizacion = useCallback(
    (opcion: DesvincularOpcion = "limpiar") => {
      // Invalida cualquier hidratación en vuelo antes de limpiar.
      vinculacionRef.current += 1;
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
      // R201-COT-06/09: invalidar hidrataciones en vuelo; el borrador manda.
      vinculacionRef.current += 1;
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

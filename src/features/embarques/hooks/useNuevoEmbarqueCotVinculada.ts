import { useCallback, useRef, useState } from "react";
import { useCotizacionHydration } from "@/features/embarques/hooks/useCotizacionHydration";
import { type CotizacionRow } from "@/features/cotizacion/hooks";
import { fetchCotizacionCostosForEmbarque } from "@/features/cotizacion/services";
import {
  mapConceptosVentaFromCotizacion,
  mapConceptosCostoFromCotizacion,
} from "@/features/embarques/domain/embarqueWizard";
import type { DesvincularOpcion } from "@/features/embarques/components/DesvincularCotizacionDialog";
import { notifyError } from "@/lib/ui/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

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
  const [cargandoCostosVinculados, setCargandoCostosVinculados] = useState(false);
  const [errorCostosVinculados, setErrorCostosVinculados] = useState(false);
  // R201-COT-06: sello de la última vinculación pedida. Una hidratación en
  // vuelo que ya no corresponde a la cotización vigente (o se desvinculó)
  // no debe escribir conceptos.
  const vinculacionRef = useRef(0);
  const costosEditadosRef = useRef(false);

  // R201-COT-06: cargar SOLO los costos. Las ventas se siembran una única vez
  // al vincular; el reintento nunca las repone (perdía las ediciones del
  // usuario capturadas mientras el fetch de costos fallaba).
  const cargarCostosVinculados = useCallback(
    async (cot: CotizacionRow, token: number) => {
      setCargandoCostosVinculados(true);
      setErrorCostosVinculados(false);
      try {
        const costos = await fetchCotizacionCostosForEmbarque(cot.id);
        if (vinculacionRef.current !== token) return;
        if (costosEditadosRef.current) {
          // No pisamos captura local, pero tampoco declaramos la importación
          // completa: queda en error para que el guard final la bloquee.
          setErrorCostosVinculados(true);
          return;
        }
        setConceptosCosto(mapConceptosCostoFromCotizacion(costos, proveedoresDb));
      } catch (error) {
        if (vinculacionRef.current !== token) return;
        setErrorCostosVinculados(true);
        notifyError(undefined, {
          title: "No se pudieron importar los costos de la cotización",
          description: "Reintenta antes de crear el embarque para no guardar una importación incompleta.",
          error: error instanceof Error ? error : new Error(String(error)),
          method: "HIDRATAR_COSTOS_COTIZACION",
          errorCode: ERROR_CODES.DB_ERROR,
        });
      } finally {
        if (vinculacionRef.current === token) setCargandoCostosVinculados(false);
      }
    },
    [setConceptosCosto, proveedoresDb],
  );

  const handleVincularCotizacion = useCallback(
    (cot: CotizacionRow) => {
      setCotizacionVinculada(cot);
      form.vincularCotizacion(cot);
      costosEditadosRef.current = false;
      setConceptosCosto([]);
      const token = ++vinculacionRef.current;
      setConceptosVenta(mapConceptosVentaFromCotizacion(cot));
      void cargarCostosVinculados(cot, token);
    },
    [form, cargarCostosVinculados, setConceptosCosto, setConceptosVenta],
  );

  const handleDesvincularCotizacion = useCallback(
    (opcion: DesvincularOpcion = "limpiar") => {
      // Invalida cualquier hidratación en vuelo antes de limpiar.
      vinculacionRef.current += 1;
      costosEditadosRef.current = false;
      setCargandoCostosVinculados(false);
      setErrorCostosVinculados(false);
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

  const reintentarCostosVinculados = useCallback(() => {
    if (!cotizacionVinculada) return;
    const token = ++vinculacionRef.current;
    // El reintento vuelve a intentar la importación de costos desde cero; las
    // ventas capturadas se conservan tal cual.
    costosEditadosRef.current = false;
    void cargarCostosVinculados(cotizacionVinculada, token);
  }, [cotizacionVinculada, cargarCostosVinculados]);

  const marcarCostosEditados = useCallback(() => {
    costosEditadosRef.current = true;
  }, []);

  // M-13 (v14-2): restauración de borrador. Vincula la cotización SIN
  // hidratar conceptos — el draft ya trae la captura del usuario y la
  // hidratación la pisaría (race con el fetch de costos).
  const restaurarVinculacion = useCallback(
    (cot: CotizacionRow) => {
      // R201-COT-06/09: invalidar hidrataciones en vuelo; el borrador manda.
      vinculacionRef.current += 1;
      costosEditadosRef.current = true;
      setCargandoCostosVinculados(false);
      setErrorCostosVinculados(false);
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
    cargandoCostosVinculados,
    errorCostosVinculados,
    reintentarCostosVinculados,
    marcarCostosEditados,
    // R201-COT-06: mientras la importación de costos no se resuelve, el paso de
    // costos queda en sólo lectura (evita ediciones que luego se descartarían).
    costosBloqueados: cargandoCostosVinculados,
  };
}

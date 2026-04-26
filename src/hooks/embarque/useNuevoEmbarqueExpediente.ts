/**
 * Sub-hook del wizard "Nuevo Embarque": gestiona el estado de vinculación con
 * una cotización aceptada y la selección de modo expediente (nuevo / existente).
 *
 * Extraído de `useNuevoEmbarqueWizard` (v8.98.0) para separar responsabilidades.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { ExpedienteCliente } from "@/hooks/embarque/useEmbarques";
import { useCotizacionHydration } from "@/hooks/embarque/useCotizacionHydration";
import {
  mapConceptosVentaFromCotizacion,
  mapConceptosCostoFromCotizacion,
} from "@/lib/domain/embarqueWizard";
import { fetchCotizacionCostosForEmbarque } from "@/services/cotizacion";
import type { CotizacionRow } from "@/hooks/cotizacion/useCotizaciones";

export type ModoExpediente = "nuevo" | "existente";

interface UseNuevoEmbarqueExpedienteParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: UseFormReturn<any>;
  vincularCotizacion: (cot: CotizacionRow) => void;
  desvincularCotizacion: () => void;
  setConceptosVenta: (v: ReturnType<typeof mapConceptosVentaFromCotizacion>) => void;
  setConceptosCosto: (
    v: ReturnType<typeof mapConceptosCostoFromCotizacion>,
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proveedoresDb: any[];
  clienteId: string | undefined;
}

export function useNuevoEmbarqueExpediente({
  methods,
  vincularCotizacion,
  desvincularCotizacion,
  setConceptosVenta,
  setConceptosCosto,
  proveedoresDb,
  clienteId,
}: UseNuevoEmbarqueExpedienteParams) {
  const [cotizacionVinculada, setCotizacionVinculada] =
    useState<CotizacionRow | null>(null);
  const [modoExpediente, setModoExpediente] = useState<ModoExpediente>("nuevo");
  const [expedienteSeleccionado, setExpedienteSeleccionado] =
    useState<ExpedienteCliente | null>(null);

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
      vincularCotizacion(cot);
      void hidratarConceptosDesdeCotizacion(cot);
    },
    [vincularCotizacion, hidratarConceptosDesdeCotizacion],
  );

  const handleDesvincularCotizacion = useCallback(() => {
    setCotizacionVinculada(null);
    desvincularCotizacion();
    setModoExpediente("nuevo");
    setExpedienteSeleccionado(null);
  }, [desvincularCotizacion]);

  useCotizacionHydration({ onPrevincular: handleVincularCotizacion });

  // Reset al cambiar de cliente
  const prevClienteRef = useRef(clienteId);
  useEffect(() => {
    if (clienteId !== prevClienteRef.current) {
      prevClienteRef.current = clienteId;
      setModoExpediente("nuevo");
      setExpedienteSeleccionado(null);
    }
  }, [clienteId]);

  const handleModoExpedienteChange = useCallback(
    (nuevoModo: ModoExpediente) => {
      setModoExpediente(nuevoModo);
      if (nuevoModo === "nuevo") {
        setExpedienteSeleccionado(null);
        methods.setValue("blMaster", "");
      }
    },
    [methods],
  );

  const handleSeleccionarExpediente = useCallback(
    (exp: ExpedienteCliente) => {
      setExpedienteSeleccionado(exp);
      methods.setValue("blMaster", exp.bl_master || "");
    },
    [methods],
  );

  return {
    cotizacionVinculada,
    handleVincularCotizacion,
    handleDesvincularCotizacion,
    modoExpediente,
    expedienteSeleccionado,
    handleModoExpedienteChange,
    handleSeleccionarExpediente,
  };
}

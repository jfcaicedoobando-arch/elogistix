import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { UseFormGetValues } from "react-hook-form";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import type { TopTarifaRow } from "@/features/costeo/types";
import { buildCostosDesdeTarifa } from "@/features/cotizacion/domain/buildCostosDesdeTarifa";
import { reemplazarCostosAutoTarifa } from "@/features/cotizacion/domain/costosAutoGenerados";
import { fetchTarifaVinculada } from "@/features/cotizacion/services/tarifaVinculada";
import type { CotizacionFormValues, FilaCostoLocal } from "@/features/cotizacion/types";
import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { notifyError } from "@/lib/ui/appFeedback";

export const CAMPOS_COSTO_TARIFA = [
  "tarifaId", "modo", "incoterm", "tipoEmbarque", "numContenedores",
  "tipoContenedor", "puertoOrigenId", "puertoDestinoId",
] as const;

type FaseCarga = "cargando" | "lista" | "error";
type EstadoCarga = { firma: string; fase: FaseCarga };

interface Args {
  getValues: UseFormGetValues<CotizacionFormValues>;
  captura: readonly unknown[];
  markup: number;
  setFilas: Dispatch<SetStateAction<FilaCostoLocal[]>>;
}

interface SolicitudCarga {
  seleccionada?: TopTarifaRow;
  soloSiVacio?: boolean;
}

function firmaTarifa(captura: readonly unknown[], markup: number): string {
  return JSON.stringify([...captura, markup]);
}

function capturarCosteoTarifa(getValues: Args["getValues"], seleccionada?: TopTarifaRow) {
  const valores = getValues(CAMPOS_COSTO_TARIFA);
  const [tarifaId, modo, incoterm, tipoEmbarque, numContenedores] = valores;
  if (!tarifaId || modo !== "Marítimo" || esIncotermSinFleteVenta(incoterm, modo)) return null;
  if (seleccionada && seleccionada.id !== tarifaId) return null;
  return { valores, tarifaId, tipoEmbarque, cantidad: Math.max(1, Number(numContenedores) || 1) };
}

/** Una instancia por wizard para selección, precarga y recálculo. */
export function useCargaCostosTarifa({ getValues, captura, markup, setFilas }: Args) {
  const [estado, setEstado] = useState<EstadoCarga>();
  const solicitudVigente = useRef<{ firma: string } | null>(null);
  const markupVigente = useRef(markup);
  const firmaActual = firmaTarifa(captura, markup);

  useEffect(() => {
    markupVigente.current = markup;
    if (solicitudVigente.current && solicitudVigente.current.firma !== firmaActual) {
      solicitudVigente.current = null;
      setEstado(undefined);
    }
  }, [firmaActual, markup]);
  useEffect(() => () => { solicitudVigente.current = null; }, []);

  const cargar = useCallback(async ({ seleccionada, soloSiVacio = false }: SolicitudCarga = {}) => {
    const seleccion = capturarCosteoTarifa(getValues, seleccionada);
    if (!seleccion) return;
    const { valores, tarifaId, tipoEmbarque, cantidad } = seleccion;
    const markupCapturado = markupVigente.current;
    const solicitud = { firma: firmaTarifa(valores, markupCapturado) };
    if (soloSiVacio && solicitudVigente.current?.firma === solicitud.firma) return;
    solicitudVigente.current = solicitud;
    const scope = captureAuthOperationScope();
    const vigente = () => solicitudVigente.current === solicitud && scope.isCurrent()
      && firmaTarifa(getValues(CAMPOS_COSTO_TARIFA), markupVigente.current) === solicitud.firma;
    setEstado({ ...solicitud, fase: "cargando" });

    try {
      const tarifa = seleccionada ?? await fetchTarifaVinculada(tarifaId);
      if (!vigente()) return;
      if (!tarifa) throw new Error("La tarifa vinculada ya no está disponible.");
      const recargos = await fetchRecargosDeTarifa(tarifaId);
      if (!vigente()) return;
      const nuevas = buildCostosDesdeTarifa({
        tarifa, recargos, markup: markupCapturado, cantidad, tipoEmbarque,
      });
      if (nuevas.length > 0) {
        setFilas(prev => vigente() && (!soloSiVacio || prev.length === 0)
          ? reemplazarCostosAutoTarifa(prev, nuevas)
          : prev);
      }
      setEstado({ ...solicitud, fase: "lista" });
    } catch (error) {
      if (!vigente()) return;
      setEstado({ ...solicitud, fase: "error" });
      notifyError(undefined, {
        title: "No se pudieron cargar los costos de la tarifa",
        description: "Puedes reintentar en Costos y utilidad. Tus costos capturados a mano se conservan.",
        error,
        method: "COTIZACION_CARGAR_COSTOS_TARIFA",
      });
    } finally {
      if (solicitudVigente.current === solicitud && !scope.isCurrent()) {
        solicitudVigente.current = null;
        setEstado(undefined);
      }
    }
  }, [getValues, setFilas]);

  return { cargar, fase: estado?.firma === firmaActual ? estado.fase : undefined, firmaActual };
}

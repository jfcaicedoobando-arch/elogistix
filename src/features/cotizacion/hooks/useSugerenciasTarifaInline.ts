/**
 * Hook de estado para `SugerenciasTarifaInline`: resuelve IDs de catálogo,
 * consulta el Top 3 de tarifas y expone el handler de selección.
 * Extraído para mantener la complejidad del componente bajo control.
 */
import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { aplicarTarifaAlForm, type AplicarTarifaOptions } from "./aplicarTarifa";
import { logTarifaSugeridaAplicada } from "@/features/cotizacion/services/bitacoraTarifa";
import { resolverPuertoId, resolverTipoId } from "./resolverCatalogos";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { todayLocalISO } from "@/lib/date/today";

interface UseSugerenciasTarifaInlineParams {
  cotizacionId?: string | null;
  aplicarOptions: AplicarTarifaOptions;
}

export function useSugerenciasTarifaInline({ cotizacionId, aplicarOptions }: UseSugerenciasTarifaInlineParams) {
  const { watch, setValue, trigger } = useFormContext<CotizacionFormValues>();
  const { data: puertos = [] } = usePuertos();
  const { data: tipos = [] } = useTiposContenedor();
  const [openDialog, setOpenDialog] = useState(false);

  const origen = watch("origen");
  const destino = watch("destino");
  const tipoContenedor = watch("tipoContenedor");
  const validez = watch("validezPropuesta");

  const puertoOrigenId = useMemo(() => resolverPuertoId(origen, puertos), [origen, puertos]);
  const puertoDestinoId = useMemo(() => resolverPuertoId(destino, puertos), [destino, puertos]);
  const tipoContenedorId = useMemo(() => resolverTipoId(tipoContenedor, tipos), [tipoContenedor, tipos]);

  const { data: tarifas = [], isFetching, error, refetch, isRefetching } = useTopTarifas({
    puertoOrigenId,
    puertoDestinoId,
    tipoContenedorId,
    fecha: todayLocalISO(),
  });

  const handleElegir = (row: TopTarifaRow) => {
    const rank = (tarifas.findIndex((t) => t.id === row.id) + 1) as 1 | 2 | 3;
    aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions, validez);
    void logTarifaSugeridaAplicada({ tarifaId: row.id, ranking: rank, cotizacionId });
  };

  const aplicarDialogElegir = (row: TopTarifaRow) => aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions, validez);

  return {
    openDialog,
    setOpenDialog,
    puertoOrigenId,
    puertoDestinoId,
    tipoContenedorId,
    tarifas,
    isFetching,
    error,
    refetch,
    isRefetching,
    handleElegir,
    aplicarDialogElegir,
  };
}

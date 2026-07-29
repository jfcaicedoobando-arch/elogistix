/**
 * Sugerencias inline Top 3 de tarifas marítimas en el Paso 1 del wizard.
 *
 * v13.31.0 — Pack C
 *
 * Se renderiza automáticamente cuando:
 *  - modo === "Marítimo"
 *  - origen + destino + tipoContenedor están resueltos a IDs del catálogo
 *  - todavía no hay tarifaId vinculada
 *
 * Si los puertos vienen como texto libre (PortSelect guarda
 * "Shanghai, China (CNSHA)"), se intenta resolver por coincidencia de nombre.
 */
import { useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import { TarifaResultCard } from "@/features/costeo/components/TarifaResultCard";
import { aplicarTarifaAlForm, type AplicarTarifaOptions } from "./aplicarTarifa";
import { logTarifaSugeridaAplicada } from "@/features/cotizacion/services/bitacoraTarifa";
import { resolverPuertoId, resolverTipoId } from "./resolverCatalogos";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import { todayLocalISO } from "@/lib/date/today";

interface SugerenciasTarifaInlineProps {
  /** Si la cotización ya está persistida, se pasa para bitácora. */
  cotizacionId?: string | null;
  /** Callback para auto-cargar costos al elegir una tarifa. */
  onAutocargaCostos?: (filas: FilaCostoLocal[]) => void;
  markup?: number;
  cantidad?: number;
}

export default function SugerenciasTarifaInline({
  cotizacionId,
  onAutocargaCostos,
  markup,
  cantidad,
}: SugerenciasTarifaInlineProps) {
  const { watch, setValue, trigger } = useFormContext<CotizacionFormValues>();
  const { data: puertos = [] } = usePuertos();
  const { data: tipos = [] } = useTiposContenedor();
  const [openDialog, setOpenDialog] = useState(false);

  const origen = watch("origen");
  const destino = watch("destino");
  const tipoContenedor = watch("tipoContenedor");
  const validez = watch("validezPropuesta");


  const puertoOrigenId = useMemo(
    () => resolverPuertoId(origen, puertos),
    [origen, puertos],
  );
  const puertoDestinoId = useMemo(
    () => resolverPuertoId(destino, puertos),
    [destino, puertos],
  );
  const tipoContenedorId = useMemo(
    () => resolverTipoId(tipoContenedor, tipos),
    [tipoContenedor, tipos],
  );

  const { data: tarifas = [], isFetching, error, refetch, isRefetching } = useTopTarifas({
    puertoOrigenId,
    puertoDestinoId,
    tipoContenedorId,
    fecha: todayLocalISO(),
  });

  const aplicarOptions: AplicarTarifaOptions = { onAutocargaCostos, markup, cantidad };

  const handleElegir = (row: TopTarifaRow) => {
    const rank = (tarifas.findIndex((t) => t.id === row.id) + 1) as 1 | 2 | 3;
    aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions, validez);
    void logTarifaSugeridaAplicada({
      tarifaId: row.id,
      ranking: rank,
      cotizacionId,
    });
  };

  const sinIds = !puertoOrigenId || !puertoDestinoId || !tipoContenedorId;

  if (sinIds) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-dashed p-3">
        <p className="text-sm text-muted-foreground">
          Selecciona origen, destino y tipo de contenedor para ver tarifas.
        </p>
        <Button type="button" size="sm" variant="default" onClick={() => setOpenDialog(true)}>
          <Search className="size-4 mr-2" /> Buscar tarifa
        </Button>
        <BuscarTarifaDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          onElegir={(row) => aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions, validez)}

          selectLabel="Usar esta tarifa"
          initial={{ puertoOrigenId, puertoDestinoId, tipoContenedorId }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          Tarifas sugeridas para esta ruta
          {!isFetching && tarifas.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({tarifas.length} vigente{tarifas.length === 1 ? "" : "s"})
            </span>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpenDialog(true)}>
          <Search className="size-4 mr-1" /> Ver todas / cambiar filtros
        </Button>
      </div>

      {isFetching && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      )}

      {!isFetching && error && (
        <ErrorStateInline
          message={error instanceof Error ? error.message : "Error desconocido al consultar tarifas."}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      )}

      {!isFetching && !error && tarifas.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
          No hay tarifas vigentes para esta combinación. Cotiza manualmente o
          captura una nueva en "Tarifas marítimas".
        </p>
      )}

      {!isFetching && !error && tarifas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tarifas.map((t, i) => (
            <TarifaResultCard
              key={t.id}
              row={t}
              rank={i + 1}
              onElegir={handleElegir}
              selectLabel="Elegir esta"
            />
          ))}
        </div>
      )}

      <BuscarTarifaDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onElegir={(row) => aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions, validez)}
        selectLabel="Usar esta tarifa"
        initial={{ puertoOrigenId, puertoDestinoId, tipoContenedorId }}
      />
    </div>
  );
}

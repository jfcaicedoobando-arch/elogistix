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
 *
 * El estado (resolución de catálogos + query de tarifas) vive en
 * `useSugerenciasTarifaInline` y el render de resultados en
 * `SugerenciasTarifaResultados` / `SugerenciasTarifaSinIds` para mantener
 * la complejidad ciclomática de este componente bajo control.
 */
import { Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import type { AplicarTarifaOptions } from "./aplicarTarifa";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import { useSugerenciasTarifaInline } from "@/features/cotizacion/hooks/useSugerenciasTarifaInline";
import { SugerenciasTarifaResultados } from "./SugerenciasTarifaResultados";
import { SugerenciasTarifaSinIds } from "./SugerenciasTarifaSinIds";

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
  const aplicarOptions: AplicarTarifaOptions = { onAutocargaCostos, markup, cantidad };

  const {
    openDialog, setOpenDialog,
    puertoOrigenId, puertoDestinoId, tipoContenedorId,
    tarifas, isFetching, error, refetch, isRefetching,
    handleElegir, aplicarDialogElegir,
  } = useSugerenciasTarifaInline({ cotizacionId, aplicarOptions });

  const sinIds = !puertoOrigenId || !puertoDestinoId || !tipoContenedorId;

  if (sinIds) {
    return (
      <SugerenciasTarifaSinIds
        openDialog={openDialog}
        setOpenDialog={setOpenDialog}
        onElegir={aplicarDialogElegir}
        puertoOrigenId={puertoOrigenId}
        puertoDestinoId={puertoDestinoId}
        tipoContenedorId={tipoContenedorId}
      />
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

      <SugerenciasTarifaResultados
        isFetching={isFetching}
        error={error}
        isRefetching={isRefetching}
        tarifas={tarifas}
        onRetry={() => void refetch()}
        onElegir={handleElegir}
      />

      <BuscarTarifaDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onElegir={aplicarDialogElegir}
        selectLabel="Usar esta tarifa"
        initial={{ puertoOrigenId, puertoDestinoId, tipoContenedorId }}
      />
    </div>
  );
}

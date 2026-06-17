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
import { Skeleton } from "@/components/ui/skeleton";
import { usePuertos, useTiposContenedor } from "@/features/catalogos/hooks";
import { useTopTarifas } from "@/features/costeo/hooks/useTopTarifas";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import { TarifaResultCard } from "@/features/costeo/components/TarifaResultCard";
import { aplicarTarifaAlForm, logTarifaSugeridaAplicada, type AplicarTarifaOptions } from "./aplicarTarifa";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

const norm = (s: string) =>
  s.toLowerCase().replace(/['"’`()]/g, "").replace(/\s+/g, " ").trim();

/**
 * Resuelve un texto libre o id de puerto contra el catálogo.
 * Si el valor ya es un id válido, lo devuelve. Si no, intenta match por
 * nombre normalizado (case + acentos no — pero los puertos vienen en ASCII).
 */
function resolverPuertoId(
  valor: string | undefined | null,
  puertos: Array<{ id: string; name: string; country: string; code: string }>,
): string | undefined {
  if (!valor) return undefined;
  if (puertos.some((p) => p.id === valor)) return valor;
  const objetivo = norm(valor);
  if (!objetivo) return undefined;
  return puertos.find((p) => {
    const candidatos = [
      p.name,
      `${p.name}, ${p.country}`,
      `${p.name}, ${p.country} (${p.code})`,
      p.code,
    ].map(norm);
    return candidatos.some((c) => c === objetivo || objetivo.startsWith(c));
  })?.id;
}

function resolverTipoId(
  valor: string | undefined | null,
  tipos: Array<{ id: string; name: string }>,
): string | undefined {
  if (!valor) return undefined;
  if (tipos.some((t) => t.id === valor)) return valor;
  const objetivo = norm(valor);
  return tipos.find((t) => norm(t.name) === objetivo)?.id;
}

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

  const { data: tarifas = [], isFetching } = useTopTarifas({
    puertoOrigenId,
    puertoDestinoId,
    tipoContenedorId,
    fecha: new Date().toISOString().slice(0, 10),
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
          Selecciona puertos del catálogo y tipo de contenedor para ver
          sugerencias automáticas, o busca manualmente.
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
          <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
        </div>
      )}

      {!isFetching && tarifas.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
          No hay tarifas vigentes para esta combinación. Cotiza manualmente o
          captura una nueva en "Tarifas marítimas".
        </p>
      )}

      {!isFetching && tarifas.length > 0 && (
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
        onElegir={(row) => aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions)}
        selectLabel="Usar esta tarifa"
        initial={{ puertoOrigenId, puertoDestinoId, tipoContenedorId }}
      />
    </div>
  );
}

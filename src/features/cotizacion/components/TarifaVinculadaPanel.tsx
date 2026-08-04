/**
 * Panel del Paso 1 del wizard de cotización: permite elegir/cambiar/quitar la
 * tarifa marítima del módulo Costeo y autollenar tránsito, días libres y
 * estado de carta garantía. La tarifa pasa a ser fuente de verdad; cualquier
 * edición manual posterior se marca en `tarifaOverride` para auditoría.
 *
 * Aplica sólo cuando `modo = Marítimo`.
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Link2, Unlink, RefreshCcw, AlertTriangle, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardSection } from "@/components/shared/WizardSection";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import CartaGarantiaBadge from "./CartaGarantiaBadge";
import TarifaResumenHeredado from "./TarifaResumenHeredado";
import { formatNumber } from "@/lib/formatters/numbers";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import SugerenciasTarifaInline from "./seccionRuta/SugerenciasTarifaInline";
import { aplicarTarifaAlForm, type AplicarTarifaOptions } from "./seccionRuta/aplicarTarifa";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";
import { resolveTipoContenedorId, computeTarifaWarnings } from "./tarifaVinculadaPanel.helpers";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  complete?: boolean;
  /** Si se provee, los recargos+flete de la tarifa elegida se inyectan como filas de costo. */
  onAutocargaCostos?: (filas: FilaCostoLocal[]) => void;
  markup?: number;
  cantidad?: number;
}

export default function TarifaVinculadaPanel({
  complete, onAutocargaCostos, markup, cantidad,
}: Props = {}) {
  const { watch, setValue, trigger } = useFormContext<CotizacionFormValues>();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const [open, setOpen] = useState(false);

  const modo = watch("modo");
  const tarifaId = watch("tarifaId");
  const validez = watch("validezPropuesta");
  const tipoContenedorActual = watch("tipoContenedor");


  const { data: tarifa, isLoading } = useTarifaVinculada(tarifaId);

  const tipoContenedorIdInicial = resolveTipoContenedorId(
    tipoContenedorActual ?? undefined,
    tiposContenedor,
  );

  if (modo !== "Marítimo") return null;

  const aplicarOptions: AplicarTarifaOptions = {
    onAutocargaCostos,
    markup,
    cantidad,
  };

  const aplicarTarifa = (row: TopTarifaRow) => {
    aplicarTarifaAlForm(setValue, trigger, row, aplicarOptions, validez);
  };


  const quitarVinculo = () => {
    setValue("tarifaId", null, OPTS);
    setValue("tarifaOverride", {}, OPTS);
  };



  const { vencidaAntesDeValidez, tipoMismatch } = computeTarifaWarnings(
    tarifa,
    validez,
    tipoContenedorActual ?? undefined,
  );

  return (
    <WizardSection title="Tarifa marítima vinculada" complete={complete}>
      <div className="space-y-3">
        {!tarifaId && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Tarifa requerida para continuar</p>
                <p className="text-muted-foreground">
                  Vincula una tarifa marítima vigente. Esto fija el costo real y
                  acelera la cotización auto-cargando flete y recargos al Paso 2.
                </p>
              </div>
            </div>
            <SugerenciasTarifaInline
              onAutocargaCostos={onAutocargaCostos}
              markup={markup}
              cantidad={cantidad}
            />
          </div>
        )}


        {tarifaId && isLoading && (
          <EmptyStateInline loading message="Cargando tarifa…" className="py-2" />
        )}

        {tarifaId && !isLoading && !tarifa && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
            <AlertTriangle className="size-4 text-warning mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">La tarifa vinculada ya no está vigente o fue eliminada.</p>
              <p className="text-muted-foreground">Quita el vínculo y elige una nueva tarifa.</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={quitarVinculo}>
              <Unlink className="size-4 mr-1" /> Quitar
            </Button>
          </div>
        )}

        {tarifa && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link2 className="size-4 text-primary" />
                  <span className="font-medium">{tarifa.naviera_nombre}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm">{tarifa.puerto_origen_nombre} → {tarifa.puerto_destino_nombre}</span>
                  <Badge variant="secondary">{tarifa.tipo_contenedor_nombre}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Agente: {tarifa.agente_nombre} · Vigente hasta {tarifa.vigente_hasta} ·
                  {" "}USD {formatNumber(Number(tarifa.flete_base), { decimals: 2 })} +
                  {" "}USD {formatNumber(Number(tarifa.recargos_total), { decimals: 2 })} recargos
                </p>
                <div className="pt-1"><CartaGarantiaBadge tarifa={tarifa} /></div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
                  <RefreshCcw className="size-4 mr-1" /> Cambiar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={quitarVinculo}>
                  <Unlink className="size-4 mr-1" /> Quitar
                </Button>
              </div>
            </div>

            {vencidaAntesDeValidez && (
              <div className="flex items-start gap-2 text-xs text-warning">
                <AlertTriangle className="size-3.5 mt-0.5" />
                La tarifa vence el {tarifa.vigente_hasta}, antes de la validez ofrecida al cliente.
              </div>
            )}
            {tipoMismatch && (
              <div className="flex items-start gap-2 text-xs text-warning">
                <AlertTriangle className="size-3.5 mt-0.5" />
                El tipo de contenedor del Paso 1 difiere del de la tarifa. Considera cambiar la tarifa.
              </div>
            )}
          </div>
        )}

        {tarifa && <TarifaResumenHeredado tarifa={tarifa} />}
      </div>

      <BuscarTarifaDialog
        open={open}
        onOpenChange={setOpen}
        onElegir={aplicarTarifa}
        selectLabel="Usar esta tarifa"
        initial={{ tipoContenedorId: tipoContenedorIdInicial }}
      />
    </WizardSection>
  );
}

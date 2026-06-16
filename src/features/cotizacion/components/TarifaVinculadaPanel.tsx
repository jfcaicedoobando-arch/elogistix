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
import { Link2, Unlink, RefreshCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardSection } from "@/components/shared/WizardSection";
import { BuscarTarifaDialog } from "@/features/costeo/components/BuscarTarifaDialog";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import CartaGarantiaBadge from "./CartaGarantiaBadge";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import SugerenciasTarifaInline from "./seccionRuta/SugerenciasTarifaInline";
import { aplicarTarifaAlForm } from "./seccionRuta/aplicarTarifa";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { TopTarifaRow } from "@/features/costeo/types";

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

const normalizarNombreContenedor = (s: string) =>
  s.toLowerCase().replace(/['"’`]/g, "").replace(/\s+/g, " ").trim();

export default function TarifaVinculadaPanel({ complete }: { complete?: boolean } = {}) {
  const { watch, setValue, trigger } = useFormContext<CotizacionFormValues>();
  const { data: tiposContenedor = [] } = useTiposContenedor();
  const [open, setOpen] = useState(false);

  const modo = watch("modo");
  const tarifaId = watch("tarifaId");
  const validez = watch("validezPropuesta");
  const tipoContenedorActual = watch("tipoContenedor");

  const { data: tarifa, isLoading } = useTarifaVinculada(tarifaId);

  // El Paso 1 guarda la etiqueta del tipo de contenedor (ej. "40' High Cube"),
  // pero el modal Buscar tarifa espera el id del catálogo. Resolvemos por nombre
  // normalizado para precargar el campo cuando el usuario abre el modal.
  const tipoContenedorIdInicial = (() => {
    if (!tipoContenedorActual) return undefined;
    if (tiposContenedor.some((t) => t.id === tipoContenedorActual)) {
      return tipoContenedorActual;
    }
    const objetivo = normalizarNombreContenedor(tipoContenedorActual);
    return tiposContenedor.find((t) => normalizarNombreContenedor(t.name) === objetivo)?.id;
  })();

  if (modo !== "Marítimo") return null;

  const aplicarTarifa = (row: TopTarifaRow) => {
    aplicarTarifaAlForm(setValue, trigger, row);
  };

  const quitarVinculo = () => {
    setValue("tarifaId", null, OPTS);
    setValue("tarifaOverride", {}, OPTS);
  };

  const vencidaAntesDeValidez =
    !!tarifa && !!validez && new Date(tarifa.vigente_hasta) < validez;
  const tipoMismatch =
    !!tarifa && !!tipoContenedorActual && tipoContenedorActual !== tarifa.tipo_contenedor_id;

  return (
    <WizardSection title="Tarifa marítima vinculada" complete={complete}>
      <div className="space-y-3">
        {!tarifaId && <SugerenciasTarifaInline />}


        {tarifaId && isLoading && (
          <p className="text-sm text-muted-foreground">Cargando tarifa…</p>
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
                  {" "}USD {Number(tarifa.flete_base).toLocaleString("es-MX", { minimumFractionDigits: 2 })} +
                  {" "}USD {Number(tarifa.recargos_total).toLocaleString("es-MX", { minimumFractionDigits: 2 })} recargos
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

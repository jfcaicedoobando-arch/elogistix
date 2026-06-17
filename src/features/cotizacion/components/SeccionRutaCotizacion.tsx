import { useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import OrigenDestinoBlock from "./seccionRuta/OrigenDestinoBlock";
import BannerOverride from "./seccionRuta/BannerOverride";
import NoMaritimoFields from "./seccionRuta/NoMaritimoFields";
import type { TarifaCtx } from "./seccionRuta/overrideHelpers";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";

function parseVigenteHasta(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

function buildTarifaCtx(tieneTarifa: boolean, override: Partial<Record<string, unknown>>): TarifaCtx {
  return {
    tieneTarifa,
    hasTransito: tieneTarifa && !override.tiempoTransitoDias,
    hasDiasLibres: tieneTarifa && !override.diasLibresDestino,
    hasCartaGarantia: tieneTarifa && !override.cartaGarantia,
    hasFrecuencia: tieneTarifa && !override.frecuencia,
    hasDiasAlmacenaje: tieneTarifa && !override.diasAlmacenaje,
  };
}

/**
 * v13.47.2 — Política tarifa-first (marítimo):
 *   Esta sección sólo captura origen, destino y tipo de movimiento.
 *   "Ruta del barco", "Validez de la propuesta" y "Seguro" se capturan en
 *   `SeccionCondicionesComerciales` DESPUÉS de elegir la tarifa.
 *
 *   Para modos no marítimos (aéreo / terrestre / general / multimodal) se
 *   conserva el flujo manual con todos los campos.
 */
export default function SeccionRutaCotizacion({ complete }: { complete?: boolean } = {}) {
  const ctx = useFormContext<CotizacionFormValues>();
  const { watch, setValue } = ctx;

  const modo = watch("modo");
  const validezPropuesta = watch("validezPropuesta");
  const modalidadEquipo = watch("modalidadEquipo");
  const tarifaId = watch("tarifaId");

  const esMaritimo = modo === 'Marítimo';
  const esTerrestre = modo === 'Terrestre';
  const usarPortSelect = esMaritimo || modo === 'Multimodal';
  const conPuntoIntermedio = esTerrestre && modalidadEquipo === 'Porta Contenedor';

  const tarifaCtx = buildTarifaCtx(!!tarifaId, watch("tarifaOverride") ?? {});

  // Clamping defensivo (sólo se activa fuera de marítimo, donde el calendario
  // sigue viviendo en esta sección).
  const { data: tarifaVinc } = useTarifaVinculada(esMaritimo ? null : tarifaId ?? null);
  const tarifaHasta = useMemo(
    () => parseVigenteHasta(tarifaVinc?.vigente_hasta ?? null),
    [tarifaVinc?.vigente_hasta],
  );

  useEffect(() => {
    if (!tarifaHasta || !validezPropuesta) return;
    if (validezPropuesta > tarifaHasta) {
      setValue("validezPropuesta", tarifaHasta, { shouldValidate: true, shouldDirty: true });
    }
  }, [tarifaHasta, validezPropuesta, setValue]);

  return (
    <WizardSection title="Ruta" complete={complete}>
      {!esMaritimo && <BannerOverride ctx={ctx} />}
      <div className={`grid grid-cols-1 gap-4 ${conPuntoIntermedio ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <OrigenDestinoBlock ctx={ctx} usarPortSelect={usarPortSelect} esTerrestre={esTerrestre} conPuntoIntermedio={conPuntoIntermedio} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
        {!esTerrestre && (
          <FormField label="Tipo de movimiento">
            <Select value={watch("tipoMovimiento")} onValueChange={v => setValue("tipoMovimiento", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CY-CY">CY-CY</SelectItem>
                <SelectItem value="CY-DR">CY-DR</SelectItem>
                <SelectItem value="DR-DR">DR-DR</SelectItem>
                <SelectItem value="DR-CY">DR-CY</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        )}

        {!esMaritimo && <NoMaritimoFields ctx={ctx} tarifaCtx={tarifaCtx} tarifaHasta={tarifaHasta} />}
      </div>
    </WizardSection>
  );
}

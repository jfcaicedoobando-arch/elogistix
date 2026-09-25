/**
 * Cambio de servicio marítimo FCL ↔ LCL en el Paso 1 del wizard.
 *
 * Extraído de `useCotizacionWizardForm` para respetar el límite de 200 líneas
 * (Power of 10 #4).
 *
 * Q4 (v13.823.396): además de limpiar medidas del servicio y la tarifa, se
 * eliminan las filas de costo AUTO-GENERADAS del servicio que se abandona
 * (flete/recargos de tarifa al pasar a LCL; flete LCL manual al volver a FCL).
 * Las filas capturadas a mano nunca se tocan.
 */
import { useCallback } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  sinCostosAutoFleteLcl,
  sinCostosAutoTarifa,
} from "@/features/cotizacion/domain/costosAutoGenerados";
import type { CotizacionFormValues, FilaCostoLocal } from "@/features/cotizacion/types";
import { desvincularTarifa } from "@/features/cotizacion/components/seccionRuta/rutaPuertoHandlers";

interface Args {
  form: UseFormReturn<CotizacionFormValues>;
  setCostosInternos: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
  /** Se conserva por compatibilidad: el MSDS ya no se descarta al cambiar servicio. */
  setMsdsFile?: (f: File | null) => void;
}

export function useCambiarTipoEmbarque({ form, setCostosInternos }: Args) {
  return useCallback((nuevoTipo: "FCL" | "LCL") => {
    // 12.35.0: setValue con shouldValidate/shouldDirty + trigger() para que el wizard
    // recalcule errors y avance step (mem://core RHF rule).
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    form.setValue("tipoEmbarque", nuevoTipo, opts);
    form.setValue("tipoContenedor", "", opts);
    form.setValue("tipoPeso", "Peso Normal", opts);
    form.setValue("dimensionesLCL", [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }], opts);
    // P1-3: el tipo de servicio no cambia la naturaleza de la mercancía; la
    // clasificación (p. ej. Mercancía Peligrosa) y su MSDS se conservan.
    // BL-COT-04: FCL se mide en contenedores; arranca en 1 (antes quedaba en 0
    // y el paso se bloqueaba sin decir por qué).
    if (nuevoTipo === "FCL" && (form.getValues("numContenedores") ?? 0) < 1) {
      form.setValue("numContenedores", 1, opts);
    }
    // v13.299.1: al pasar a LCL se elimina la tarifa marítima vinculada
    // (LCL captura flete manual). Evita estado huérfano heredado de FCL.
    if (nuevoTipo === "LCL") {
      // P1-4: si había tarifa, se desvincula con el helper compartido (limpia
      // agente/naviera y heredados no editados a mano). Sin tarifa, agente y
      // naviera son selección manual y se respetan.
      if (form.getValues("tarifaId")) desvincularTarifa(form);
      else form.setValue("tarifaOverride", {}, opts);
    }
    setCostosInternos((prev) =>
      nuevoTipo === "LCL" ? sinCostosAutoTarifa(prev) : sinCostosAutoFleteLcl(prev),
    );
    void form.trigger(["tipoEmbarque", "tipoContenedor", "tipoPeso", "dimensionesLCL", "tipoCarga", "tarifaId"]);
  }, [form, setCostosInternos]);
}

/**
 * Cambio de servicio marítimo FCL ↔ LCL en el Paso 1 del wizard.
 *
 * Extraído de `useCotizacionWizardForm` para respetar el límite de 200 líneas
 * (Power of 10 #4).
 *
 * Q4 (v13.823.396): además de limpiar los campos de mercancía y la tarifa, se
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

interface Args {
  form: UseFormReturn<CotizacionFormValues>;
  setCostosInternos: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
  setMsdsFile: (f: File | null) => void;
}

export function useCambiarTipoEmbarque({ form, setCostosInternos, setMsdsFile }: Args) {
  return useCallback((nuevoTipo: "FCL" | "LCL") => {
    // 12.35.0: setValue con shouldValidate/shouldDirty + trigger() para que el wizard
    // recalcule errors y avance step (mem://core RHF rule).
    const opts = { shouldValidate: true, shouldDirty: true } as const;
    form.setValue("tipoEmbarque", nuevoTipo, opts);
    form.setValue("tipoContenedor", "", opts);
    form.setValue("tipoPeso", "Peso Normal", opts);
    form.setValue("dimensionesLCL", [{ piezas: 0, alto_cm: 0, largo_cm: 0, ancho_cm: 0, volumen_m3: 0 }], opts);
    form.setValue("tipoCarga", "Carga General", opts);
    // BL-COT-04: FCL se mide en contenedores; arranca en 1 (antes quedaba en 0
    // y el paso se bloqueaba sin decir por qué).
    if (nuevoTipo === "FCL" && (form.getValues("numContenedores") ?? 0) < 1) {
      form.setValue("numContenedores", 1, opts);
    }
    // v13.299.1: al pasar a LCL se elimina la tarifa marítima vinculada
    // (LCL captura flete manual). Evita estado huérfano heredado de FCL.
    if (nuevoTipo === "LCL") {
      form.setValue("tarifaId", null, opts);
      form.setValue("tarifaOverride", {}, opts);
    }
    setCostosInternos((prev) =>
      nuevoTipo === "LCL" ? sinCostosAutoTarifa(prev) : sinCostosAutoFleteLcl(prev),
    );
    void form.trigger(["tipoEmbarque", "tipoContenedor", "tipoPeso", "dimensionesLCL", "tipoCarga", "tarifaId"]);
    setMsdsFile(null);
  }, [form, setCostosInternos, setMsdsFile]);
}

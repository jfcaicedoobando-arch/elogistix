/**
 * v13.823.396 · Q3/Q5 — Invalidación de la tarifa marítima vinculada.
 *
 * Q3: si el ejecutivo cambia a mano el tipo de contenedor mientras hay una
 * tarifa vinculada, la cotización quedaba con costos y recargos de otro tipo
 * (un 40' valuado con tarifa de 20'). El panel sólo sugería "considera cambiar
 * la tarifa" y dejaba guardar y convertir.
 *
 * Q5: al pasar a un Incoterm marítimo sin flete de venta (CIF/CFR/CIP/CPT/
 * DAP/DDP/DAT) la UI oculta la tarifa, pero el flete internacional y sus
 * recargos seguían vivos en el formulario y en los costos.
 *
 * En ambos casos se rompe el vínculo y se eliminan SÓLO las filas de costo
 * auto-generadas desde la tarifa; los renglones capturados a mano (por ejemplo
 * gastos locales en destino) se conservan intactos.
 */
import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTiposContenedor } from "@/features/catalogos/hooks";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";
import { resolveTipoContenedorId } from "@/features/cotizacion/components/tarifaVinculadaPanel.helpers";
import { esIncotermSinFleteVenta } from "@/features/cotizacion/utils/incotermRules";
import { sinCostosAutoTarifa } from "@/features/cotizacion/domain/costosAutoGenerados";
import { notifyWarning } from "@/lib/ui/appFeedback.notices";
import type { CotizacionFormValues, FilaCostoLocal } from "@/features/cotizacion/types";

const OPTS = { shouldValidate: true, shouldDirty: true } as const;

interface Args {
  form: UseFormReturn<CotizacionFormValues>;
  setCostosInternos: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

export function useInvalidarTarifaAutomatica({ form, setCostosInternos }: Args): void {
  const tarifaId = form.watch("tarifaId");
  const modo = form.watch("modo");
  const incoterm = form.watch("incoterm");
  const tipoEmbarque = form.watch("tipoEmbarque");
  const tipoContenedor = form.watch("tipoContenedor");

  const { data: tarifa } = useTarifaVinculada(tarifaId);
  const { data: tiposContenedor = [] } = useTiposContenedor();

  // Evita repetir el aviso mientras React vuelve a renderear con el mismo estado.
  const avisadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tarifaId) {
      avisadoRef.current = null;
      return;
    }

    const sinFleteVenta = esIncotermSinFleteVenta(incoterm, modo);
    const tipoActualId = resolveTipoContenedorId(tipoContenedor ?? undefined, tiposContenedor);
    const tipoIncompatible =
      tipoEmbarque === "FCL" &&
      !!tarifa?.tipo_contenedor_id &&
      !!tipoActualId &&
      tipoActualId !== tarifa.tipo_contenedor_id;

    const motivo = sinFleteVenta ? "incoterm" : tipoIncompatible ? "tipo" : null;
    if (!motivo) return;

    const marca = `${tarifaId}:${motivo}`;
    if (avisadoRef.current === marca) return;
    avisadoRef.current = marca;

    form.setValue("tarifaId", null, OPTS);
    form.setValue("tarifaOverride", {}, OPTS);
    setCostosInternos((prev) => sinCostosAutoTarifa(prev));

    notifyWarning(undefined, {
      title: "Tarifa marítima desvinculada",
      description:
        motivo === "incoterm"
          ? `Con Incoterm ${incoterm} el flete internacional lo paga el proveedor en origen: se quitó la tarifa vinculada y sus costos automáticos de flete y recargos.`
          : "Cambiaste el tipo de contenedor: se quitó la tarifa vinculada y sus costos automáticos. Elige una tarifa del tipo correcto.",
    });
  }, [tarifaId, incoterm, modo, tipoEmbarque, tipoContenedor, tarifa, tiposContenedor, form, setCostosInternos]);
}

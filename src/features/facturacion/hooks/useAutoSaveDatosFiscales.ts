/**
 * useAutoSaveDatosFiscales — auto-guardado con debounce para la card
 * "Configuración de timbrado". Reemplaza al botón "Guardar cambios" manual.
 *
 * - Debounce 500 ms desde el último cambio antes de disparar el patch.
 * - `estado` expone 'idle' | 'saving' | 'saved' | 'error' para el indicador visual.
 * - No dispara guardado en el primer render (evita re-guardar los valores iniciales).
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError } from "@/lib/ui/appFeedback";
import {
  actualizarDatosTimbradoFactura,
  type DatosTimbradoPatch,
} from "@/features/facturacion/services";
import type { DatosFiscalesEstado } from "@/features/facturacion/domain/datosFiscalesForm";
import { buildDatosTimbradoPatch } from "@/features/facturacion/domain/datosFiscalesForm";

export type AutoSaveEstado = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 500;

export function useAutoSaveDatosFiscales(
  facturaId: string,
  moneda: string,
  values: DatosFiscalesEstado,
) {
  const qc = useQueryClient();
  const [estado, setEstado] = useState<AutoSaveEstado>("idle");
  const [ultimoGuardado, setUltimoGuardado] = useState<number | null>(null);
  const primeraRender = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enVueloRef = useRef<AbortController | null>(null);
  // Ref al último `values` — se depende de campos primitivos abajo; el ref
  // permite leer el objeto completo al momento de guardar sin re-suscribir.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    if (primeraRender.current) {
      primeraRender.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      // Cancela un guardado anterior en vuelo si aún no terminó.
      enVueloRef.current?.abort();
      const ctrl = new AbortController();
      enVueloRef.current = ctrl;
      const patch: DatosTimbradoPatch = buildDatosTimbradoPatch(valuesRef.current, moneda);
      setEstado("saving");
      try {
        await actualizarDatosTimbradoFactura(facturaId, patch);
        if (ctrl.signal.aborted) return;
        setEstado("saved");
        setUltimoGuardado(Date.now());
        qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId) });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setEstado("error");
        notifyError(undefined, {
          title: "No se pudo guardar",
          error: err,
          method: "FACTURA_DATOS_FISCALES_AUTOSAVE",
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    qc,
    facturaId,
    moneda,
    values.usoCfdi,
    values.formaPago,
    values.metodoPago,
    values.diasCredito,
    values.tipoCambio,
    values.notas,
  ]);

  return { estado, ultimoGuardado };
}

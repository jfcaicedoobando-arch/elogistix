import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { hoyMx } from "@/lib/date/mx";
import {
  aplicarTarifaTarifario, costeoQueryKeys, listarCargos,
  listarTarifasTarifario, tarifasCoincidentes,
} from "@/features/costeo";
import type { SolicitudPricingRow } from "../services/pricing/tiposPricing";

export function useOpcionesTarifario(s: SolicitudPricingRow) {
  const qc = useQueryClient();
  const hoy = hoyMx();
  const tarifas = useQuery({ queryKey: costeoQueryKeys.tarifario.tarifas("vigentes"), queryFn: () => listarTarifasTarifario("vigentes", hoy) });
  const esFob = (s.incoterm ?? "").toUpperCase() === "FOB";
  const fob = useQuery({ queryKey: costeoQueryKeys.tarifario.cargos("fob"), queryFn: () => listarCargos("fob"), enabled: esFob });
  const locales = useQuery({ queryKey: costeoQueryKeys.tarifario.cargos("locales"), queryFn: () => listarCargos("locales") });
  const [busy, setBusy] = useState<string | null>(null);
  const elegida = s.tarifa_tarifario_id;
  const opciones = elegida
    ? (tarifas.data ?? []).filter((t) => t.id === elegida)
    : tarifasCoincidentes(s, tarifas.data ?? [], hoy);

  const elegir = async (id: string) => {
    setBusy(id);
    try {
      await aplicarTarifaTarifario(s.id, id);
      notifySuccess(undefined, { title: "Opción guardada en la solicitud" });
      await qc.invalidateQueries();
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo guardar la opción. Verifica que la tarifa siga vigente.",
        error, method: "CRM_APLICAR_TARIFA_TARIFARIO",
      });
    } finally { setBusy(null); }
  };

  return { opciones, elegida, esFob, cargosFob: fob.data ?? [], cargosLocales: locales.data ?? [],
    isLoading: tarifas.isLoading, busy, elegir };
}

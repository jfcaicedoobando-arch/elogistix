/**
 * P2-IVA — Interruptor por organización del estímulo de IVA 8% (región
 * fronteriza norte/sur). Por omisión está DESHABILITADO: la clave no existe en
 * organizaciones nuevas y el fallback es `false`, así que ninguna selección
 * nueva puede usar el 8% hasta que Contabilidad lo active.
 *
 * No afecta a los conceptos ya guardados al 8%: sólo gobierna la UI de captura.
 */
import { useConfigValue } from "@/features/configuracion/hooks/useConfiguracion";
import { CONFIG_IVA_FRONTERA } from "@/lib/financial/ivaFrontera";

export function useIvaFronteraHabilitada(): boolean {
  const valor = useConfigValue<unknown>(
    CONFIG_IVA_FRONTERA.categoria,
    CONFIG_IVA_FRONTERA.clave,
    false,
  );
  return valor === true || valor === "true";
}

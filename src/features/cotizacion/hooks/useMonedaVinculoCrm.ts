/**
 * A1/A7 — Divisa del vínculo CRM en el paso 1 de cotización.
 *
 * La moneda que se muestra debe ser la REAL de la oportunidad (otra entidad),
 * no la persistida en la cotización. Si difieren se reporta la discrepancia:
 * los importes se preservan tal cual, aquí nunca se convierte ni se repara.
 */
import { useOportunidad } from "@/features/crm/hooks";

export function useMonedaVinculoCrm(oportunidadId: string, monedaCotizacion: string | null) {
  const { data: oportunidad } = useOportunidad(oportunidadId || undefined);
  const monedaReal = oportunidad?.moneda ?? null;
  return {
    /** Divisa a mostrar: la real de la oportunidad si ya cargó. */
    monedaMostrada: monedaReal ?? monedaCotizacion,
    monedaDiscrepante: Boolean(monedaReal && monedaCotizacion && monedaReal !== monedaCotizacion),
  };
}

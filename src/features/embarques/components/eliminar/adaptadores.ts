import type { EmbarqueDependenciasFinancieras } from "@/features/embarques/hooks";
import type { MotivosBloqueoEmbarque } from "@/features/embarques/services";

/**
 * Adapta los motivos server-side (Fase E) al shape del hook client-side
 * `useEmbarqueDependenciasFinancieras` que consume el diálogo de bloqueo.
 * No conocemos los folios/ids desde el server (sólo counts + expediente),
 * así que se dejan las listas vacías y el componente muestra "… y N más".
 */
export function motivosADependencias(m: MotivosBloqueoEmbarque): EmbarqueDependenciasFinancieras {
  return {
    tieneDependencias: true,
    cxc: { count: m.facturas, facturas: [] },
    cxp: { count: m.cxp, facturas: [] },
    notasCredito: m.notas_credito_cxc + m.notas_credito_cxp,
    pagos: m.pagos_cxc + m.pagos_cxp,
  };
}

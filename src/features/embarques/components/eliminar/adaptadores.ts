import type { EmbarqueDependenciasFinancieras } from "@/features/embarques/hooks";
import type { MotivosBloqueoEmbarque } from "@/features/embarques/services";
import { diagnosticoADependencias } from "@/features/embarques/services/dependenciasFinancieras";

/** Preserve every reason; legacy HINTs have counts but no invoice examples. */
export function motivosADependencias(m: MotivosBloqueoEmbarque): EmbarqueDependenciasFinancieras {
  if ("version" in m) return diagnosticoADependencias(m);
  return {
    tieneDependencias: true,
    cxc: { count: m.facturas, facturas: [] },
    cxp: { count: m.cxp, facturas: [] },
    notasCredito: m.notas_credito_cxc + m.notas_credito_cxp,
    pagos: m.pagos_cxc + m.pagos_cxp,
    proformas: m.proformas,
    comisionesDefinitivas: m.comisiones_definitivas,
    cerrado: m.cerrado,
  };
}

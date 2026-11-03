/** Server-authoritative deletion diagnostic; no table-query fallback. */
import { supabase } from "@/integrations/supabase/client";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import {
  parseDiagnosticoBajaEmbarque,
  type DiagnosticoBajaEmbarque,
  type FacturaLigada,
} from "./diagnosticoBajaEmbarque";

export type { FacturaLigada };

export interface EmbarqueDependenciasFinancieras {
  tieneDependencias: boolean;
  cxc: { count: number; facturas: FacturaLigada[] };
  cxp: { count: number; facturas: FacturaLigada[] };
  notasCredito: number;
  pagos: number;
  proformas: number;
  comisionesDefinitivas: number;
  cerrado: boolean;
}

export const DEPENDENCIAS_FINANCIERAS_ERROR =
  "No pudimos verificar los motivos que impiden eliminar el embarque. Vuelve a intentar la verificación.";

export function diagnosticoADependencias(d: DiagnosticoBajaEmbarque): EmbarqueDependenciasFinancieras {
  return {
    tieneDependencias: d.bloqueado,
    cxc: { count: d.facturas, facturas: d.ejemplos_cxc },
    cxp: { count: d.cxp, facturas: d.ejemplos_cxp },
    notasCredito: d.notas_credito_cxc + d.notas_credito_cxp,
    pagos: d.pagos_cxc + d.pagos_cxp,
    proformas: d.proformas,
    comisionesDefinitivas: d.comisiones_definitivas,
    cerrado: d.cerrado,
  };
}

export async function fetchEmbarqueDependenciasFinancieras(
  embarqueId: string,
  signal?: AbortSignal,
): Promise<EmbarqueDependenciasFinancieras> {
  const scope = captureAuthDataScope();
  try {
    const request = supabase.rpc("diagnosticar_baja_embarque", { p_embarque_id: embarqueId });
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    scope.assertCurrent();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (error) throw error;
    return diagnosticoADependencias(parseDiagnosticoBajaEmbarque(data, embarqueId));
  } catch {
    scope.assertCurrent();
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    // Missing/denied RPC, transport error or incompatible response never means empty.
    throw new Error(DEPENDENCIAS_FINANCIERAS_ERROR);
  }
}

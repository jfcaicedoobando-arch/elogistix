import type { DiagnosticoBajaEmbarque } from "../../diagnosticoBajaEmbarque";

export const EMBARQUE_ID = "11111111-1111-4111-8111-111111111111";
export const OTRO_EMBARQUE_ID = "22222222-2222-4222-8222-222222222222";
export const FACTURA_ID = "33333333-3333-4333-8333-333333333333";
export function diagnosticoBaja(overrides: Partial<DiagnosticoBajaEmbarque> = {}): DiagnosticoBajaEmbarque {
  return {
    version: 1, embarque_id: EMBARQUE_ID, expediente: "H14-FICTICIO",
    facturas: 0, cxp: 0, pagos_cxc: 0, pagos_cxp: 0,
    notas_credito_cxc: 0, notas_credito_cxp: 0, comisiones_definitivas: 0,
    proformas: 0, cerrado: false, bloqueado: false, ejemplos_cxc: [], ejemplos_cxp: [],
    ...overrides,
  };
}

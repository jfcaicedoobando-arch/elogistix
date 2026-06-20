/**
 * Fixtures compartidos para los tests de DataTable / VirtualDataTable.
 * Extraídos en 13.85.3 al dividir DataTable.regression.test.tsx.
 *
 * Nombre con prefijo `_` para que el runner los ignore (no contiene tests).
 */
export interface EmbarqueRow {
  id: string;
  numero: string;
  cliente: string;
  total: number;
}

export interface CotizacionRow {
  id: string;
  folio: string;
  cliente: string;
  monto: number;
}

export const embarques: EmbarqueRow[] = [
  { id: "e1", numero: "EMB-001", cliente: "ACME", total: 1500 },
  { id: "e2", numero: "EMB-002", cliente: "Globex", total: 2300 },
  { id: "e3", numero: "EMB-003", cliente: "Initech", total: 900 },
];

export const cotizaciones: CotizacionRow[] = [
  { id: "c1", folio: "COT-100", cliente: "ACME", monto: 500 },
  { id: "c2", folio: "COT-101", cliente: "Globex", monto: 800 },
];

/**
 * P1 · Auditoría IVA — un renglón legacy sin `tipo_iva` NO se muestra como 16%:
 * se marca "Por confirmar" y exige elección deliberada antes de guardar.
 *
 * Vive fuera de `FacturaConceptosEditorRows.tsx` para que las insignias puedan
 * reusar la etiqueta sin import circular.
 */
export const LABEL_TRATAMIENTO_PENDIENTE = "Por confirmar";
export const MSG_TRATAMIENTO_PENDIENTE =
  "Este renglón no tiene tratamiento de IVA registrado. Elige el que corresponda (16%, 8%, tasa 0%, exento o no objeto) antes de guardar; el sistema no supone 16%.";

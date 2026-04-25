/**
 * Acceso puro a datos para proformas. Sin React Query, sin toasts.
 * Barrel re-export. La lógica vive en submódulos en src/services/proforma/.
 */
export * from "./proforma/types";
export * from "./proforma/queries";
export * from "./proforma/crud";
export * from "./proforma/facturar";
export * from "./proforma/consolidar";

/**
 * BL-9 — Definición ÚNICA de la ventana "Por vencer" en cartera (CxC).
 *
 * El canon se movió a `@/lib/domain/vencimiento` para que CxC, CxP, bandejas,
 * tesorería y el dashboard compartan el mismo predicado. Este módulo se queda
 * como puerta de entrada del feature de facturación (compatibilidad de imports).
 */
export { estaPorVencer } from "@/lib/domain/vencimiento";

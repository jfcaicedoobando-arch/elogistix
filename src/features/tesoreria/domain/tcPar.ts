/**
 * Re-export del helper compartido de convención mexicana de tipo de cambio.
 * La implementación vive en `@/lib/financial/tcPar` (v13.751.1) para que
 * facturación y CxP usen exactamente la misma etiqueta que tesorería.
 */
export {
  parTc,
  multiplicadorOrigenDestino,
  etiquetaTc,
  etiquetaTcContraMxn,
  ayudaTcContraMxn,
  TC_PLACEHOLDER_MXN,
  type MonedaTc,
  type ParTc,
} from "@/lib/financial/tcPar";

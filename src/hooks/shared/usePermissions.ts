import { useAuth } from "@/lib/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";

/**
 * Permisos de UI por rol.
 *
 * Centraliza la matriz de capacidades para los 10 roles soportados (más legacy)
 * de modo que los componentes y rutas la consuman vía booleans estables.
 *
 * La API pública (`canEdit`, `canViewFinancials`, `canEditCrm`, `isAdmin`,
 * `isSuperAdmin`, `isOperador`) se conserva por compatibilidad con los
 * consumidores existentes.
 */

const TENANT_ADMINS: readonly AppRole[] = ["super_admin", "admin_org", "admin"];
const OPERATIONS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "gerente_comercial",
  "coordinador_logistico",
  "operador",
  "ejecutivo_pricing",
  "vendedor",
];
const FINANCE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "tesorero",
  "auxiliar_contable",
  "ejecutivo_cobranza",
];
const FINANCE_VIEWERS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "gerente_visor",
  "gerente_comercial",
  "contador",
  "tesorero",
  "auxiliar_contable",
  "ejecutivo_cobranza",
  "ejecutivo_pricing",
  "vendedor",
];
const SALES: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "vendedor",
  "ejecutivo_pricing",
];

const COTIZAR_SIN_DESGLOSE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
];

// v13.303.26 — eliminado `CREAR_EMBARQUE_LIBRE`: la política tarifa-first no admite excepciones,
// todo embarque nuevo nace de una cotización aceptada (incluidos super_admin/admin_org).


const OVERRIDE_TARIFA_PRICING: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
];

// v13.54.0 — Bloque Q: separación de responsabilidades financieras.
// El auxiliar captura, el tesorero paga; el contador emite, cobranza cobra.
const EMITIR_FACTURA_CLIENTE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
];
const CAPTURAR_FACTURA_PROVEEDOR: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "auxiliar_contable",
];
const PAGAR_PROVEEDOR: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "tesorero",
];
// v13.213.40 — auxiliar_contable NO registra cobros (separación de responsabilidades):
// sólo captura facturas de proveedor. Cobros los registran contador + ejecutivo_cobranza.
const REGISTRAR_COBRO: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "ejecutivo_cobranza",
];

// v13.106.4 — El cierre de embarques pasa de finanzas a operaciones.
// Coordinador logístico ejecuta el cierre cuando el checklist está completo;
// gerente de operaciones y admins quedan como respaldo gerencial.
const CERRAR_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
];

// v13.118.0 — Handoff cotización → embarque (Vendedor confirma con cliente y
// pasa el balón al Coordinador Logístico para ejecutar).
const HANDOFF_COTIZACION: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "gerente_operaciones",
  "coordinador_logistico",
  "vendedor",
];

// v13.145.8 — Aceptar/Rechazar proforma manualmente (cuando el cliente
// confirma por WhatsApp/llamada/email) queda limitado a admins y gerentes.
const RESPONDER_PROFORMA_MANUAL: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "gerente_operaciones",
];

// FIX C1 (S5-01) — Espejo UI del guard SQL de `eliminar_embarque_completo`:
// super_admin o admin/operador (jerarquía `has_role`) de la misma organización.
const ELIMINAR_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
  "ejecutivo_pricing",
];

const has = (list: readonly AppRole[], role: AppRole | null | undefined) =>
  !!role && list.includes(role);

export function usePermissions() {
  const { role, effectiveRole } = useAuth();
  const roleStr = effectiveRole as AppRole | null;

  const canAdminTenant = has(TENANT_ADMINS, roleStr);
  const canEditOperations = has(OPERATIONS, roleStr);
  const canEditFinance = has(FINANCE, roleStr);
  const canViewFinancials = has(FINANCE_VIEWERS, roleStr);
  const canEditSales = has(SALES, roleStr);
  const canCotizarSinDesglose = has(COTIZAR_SIN_DESGLOSE, roleStr);
  // v13.303.26 — `canCrearEmbarqueLibre` eliminado.
  const canOverrideTarifaPricing = has(OVERRIDE_TARIFA_PRICING, roleStr);

  // Bloque Q
  const canEmitirFactura = has(EMITIR_FACTURA_CLIENTE, roleStr);
  const canCapturarFacturaProveedor = has(CAPTURAR_FACTURA_PROVEEDOR, roleStr);
  const canPagarProveedor = has(PAGAR_PROVEEDOR, roleStr);
  const canRegistrarCobro = has(REGISTRAR_COBRO, roleStr);
  const canCerrarEmbarque = has(CERRAR_EMBARQUE, roleStr);
  const canHandoffCotizacion = has(HANDOFF_COTIZACION, roleStr);
  const canResponderProformaManual = has(RESPONDER_PROFORMA_MANUAL, roleStr);
  const canEliminarEmbarque = has(ELIMINAR_EMBARQUE, roleStr);

  const canEdit = canEditOperations || canEditFinance;
  const isAdmin = canAdminTenant;
  const isSuperAdmin = (role as AppRole) === "super_admin";
  const isOperador = roleStr === "operador" || roleStr === "coordinador_logistico";
  const canEditCrm = canEdit || canEditSales;

  return {
    canEdit,
    canEditCrm,
    isAdmin,
    isSuperAdmin,
    isOperador,
    canViewFinancials,
    role: effectiveRole,
    canAdminTenant,
    canEditOperations,
    canEditFinance,
    canEditSales,
    canCotizarSinDesglose,
    
    canOverrideTarifaPricing,
    canEmitirFactura,
    canCapturarFacturaProveedor,
    canPagarProveedor,
    canRegistrarCobro,
    canCerrarEmbarque,
    canHandoffCotizacion,
    canResponderProformaManual,
    canEliminarEmbarque,
  };
}

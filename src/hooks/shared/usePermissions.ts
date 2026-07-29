import { useAuth } from "@/lib/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";
import {
  ADMIN_CUENTAS_BANCARIAS,
  CAPTURAR_FACTURA_PROVEEDOR,

  CERRAR_EMBARQUE,
  COTIZAR_SIN_DESGLOSE,
  ELIMINAR_EMBARQUE,
  EMITIR_FACTURA_CLIENTE,
  FINANCE,
  FINANCE_VIEWERS,
  HANDOFF_COTIZACION,
  OPERATIONS,
  OVERRIDE_TARIFA_PRICING,
  PAGAR_PROVEEDOR,
  REGISTRAR_COBRO,
  RESPONDER_PROFORMA_MANUAL,
  SALES,
  TENANT_ADMINS,
  hasRole as has,
} from "./permissionMatrix";

/**
 * Permisos de UI por rol.
 *
 * La matriz de capacidades vive en `permissionMatrix.ts`; aquí sólo se
 * resuelve contra el rol efectivo del usuario.
 *
 * La API pública (`canEdit`, `canViewFinancials`, `canEditCrm`, `isAdmin`,
 * `isSuperAdmin`, `isOperador`) se conserva por compatibilidad con los
 * consumidores existentes.
 */
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

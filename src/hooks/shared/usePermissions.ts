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

const CREAR_EMBARQUE_LIBRE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
];

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
const REGISTRAR_COBRO: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "ejecutivo_cobranza",
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
  const canCrearEmbarqueLibre = has(CREAR_EMBARQUE_LIBRE, roleStr);
  const canOverrideTarifaPricing = has(OVERRIDE_TARIFA_PRICING, roleStr);

  // Bloque Q
  const canEmitirFactura = has(EMITIR_FACTURA_CLIENTE, roleStr);
  const canCapturarFacturaProveedor = has(CAPTURAR_FACTURA_PROVEEDOR, roleStr);
  const canPagarProveedor = has(PAGAR_PROVEEDOR, roleStr);
  const canRegistrarCobro = has(REGISTRAR_COBRO, roleStr);

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
    canCrearEmbarqueLibre,
    canOverrideTarifaPricing,
    canEmitirFactura,
    canCapturarFacturaProveedor,
    canPagarProveedor,
    canRegistrarCobro,
  };
}

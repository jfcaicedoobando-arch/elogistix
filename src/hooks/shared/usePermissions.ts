import { useAuth } from "@/lib/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";
import {
  ADMIN_CUENTAS_BANCARIAS,
  APROBAR_FACTURA_PROVEEDOR,
  CAPTURAR_FACTURA_PROVEEDOR,
  CAPTURAR_MOVIMIENTO_BANCARIO,

  CERRAR_EMBARQUE,
  CONFIGURAR_AUTORIZACION_CLIENTE,
  COTIZAR_SIN_DESGLOSE,
  ELIMINAR_EMBARQUE,
  EMITIR_FACTURA_CLIENTE,
  EXPEDIENTE_ESCRITURA,
  OPERAR_REFACTURACION,
  FINANCE,
  FINANCE_VIEWERS,
  HANDOFF_COTIZACION,
  OPERATIONS,
  OVERRIDE_TARIFA_PRICING,
  PAGAR_PROVEEDOR,
  PROFORMAS_ESCRITURA,
  REGISTRAR_COBRO,
  RESPONDER_PROFORMA_MANUAL,
  SALES,
  SUBIR_FACTURA_ENTRANTE_EMBARQUE,
  ADJUNTAR_XML_FACTURA_ENTRANTE,
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
  const canAdminCuentasBancarias = has(ADMIN_CUENTAS_BANCARIAS, roleStr);
  const canCapturarMovimientoBancario = has(CAPTURAR_MOVIMIENTO_BANCARIO, roleStr);

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
  const canSubirFacturaEntranteEmbarque = has(SUBIR_FACTURA_ENTRANTE_EMBARQUE, roleStr);
  const canAdjuntarXmlFacturaEntrante = has(ADJUNTAR_XML_FACTURA_ENTRANTE, roleStr);
  const canAprobarFacturaProveedor = has(APROBAR_FACTURA_PROVEEDOR, roleStr);
  const canPagarProveedor = has(PAGAR_PROVEEDOR, roleStr);
  const canRegistrarCobro = has(REGISTRAR_COBRO, roleStr);
  const canOperarRefacturacion = has(OPERAR_REFACTURACION, roleStr);
  const canCerrarEmbarque = has(CERRAR_EMBARQUE, roleStr);
  const canHandoffCotizacion = has(HANDOFF_COTIZACION, roleStr);
  const canResponderProformaManual = has(RESPONDER_PROFORMA_MANUAL, roleStr);
  // VF-20: espejo UI de las policies RLS de escritura en `proformas`.
  const canEditarProforma = has(PROFORMAS_ESCRITURA, roleStr);
  const canEliminarEmbarque = has(ELIMINAR_EMBARQUE, roleStr);
  // v13.624.0 — política de autorización del cliente ("cliente de casa").
  const canConfigurarAutorizacionCliente = has(CONFIGURAR_AUTORIZACION_CLIENTE, roleStr);

  const canEdit = canEditOperations || canEditFinance;
  // R4BD-04: espejo de las policies del expediente (documentos y contactos).
  const canEditExpediente = has(EXPEDIENTE_ESCRITURA, roleStr);
  const isAdmin = canAdminTenant;
  const isSuperAdmin = (role as AppRole) === "super_admin";
  const isOperador = roleStr === "operador" || roleStr === "coordinador_logistico";
  const canEditCrm = canEdit || canEditSales;

  return {
    canEdit,
    canEditExpediente,
    canEditCrm,
    isAdmin,
    isSuperAdmin,
    isOperador,
    canViewFinancials,
    role: effectiveRole,
    canAdminTenant,
    canAdminCuentasBancarias,
    canCapturarMovimientoBancario,

    canEditOperations,
    canEditFinance,
    canEditSales,
    canCotizarSinDesglose,
    canOverrideTarifaPricing,
    canEmitirFactura,
    canCapturarFacturaProveedor,
    canSubirFacturaEntranteEmbarque,
    canAdjuntarXmlFacturaEntrante,
    canAprobarFacturaProveedor,
    canPagarProveedor,
    canRegistrarCobro,
    canOperarRefacturacion,
    canCerrarEmbarque,
    canHandoffCotizacion,
    canResponderProformaManual,
    canEditarProforma,
    canEliminarEmbarque,
    canConfigurarAutorizacionCliente,
  };
}

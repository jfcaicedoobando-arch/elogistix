import { useAuth } from "@/lib/contexts/AuthContext";
import type { AppRole } from "@/types/appRole";
import {
  ADMIN_CUENTAS_BANCARIAS,
  APROBAR_FACTURA_PROVEEDOR,
  CAPTURAR_FACTURA_PROVEEDOR,
  CAPTURAR_MOVIMIENTO_BANCARIO,

  CERRAR_EMBARQUE,
  CONFIGURAR_AUTORIZACION_CLIENTE,
  COST_VIEWERS,
  COTIZAR_SIN_DESGLOSE,
  CRM_CONFIG,
  CRM_CREAR_LEAD,
  CRM_GESTION_TODOS_LEADS,
  CRM_TOMAR_LEAD,

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
  puedeVerCostosCotizacion,
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
  const { role, effectiveRole, user } = useAuth();
  const roleStr = effectiveRole as AppRole | null;

  const canAdminTenant = has(TENANT_ADMINS, roleStr);
  const canAdminCuentasBancarias = has(ADMIN_CUENTAS_BANCARIAS, roleStr);
  const canCapturarMovimientoBancario = has(CAPTURAR_MOVIMIENTO_BANCARIO, roleStr);

  const canEditOperations = has(OPERATIONS, roleStr);
  const canEditFinance = has(FINANCE, roleStr);
  const canViewFinancials = has(FINANCE_VIEWERS, roleStr);
  // QA B-07: costo/utilidad/margen ocultos para roles comerciales.
  const canViewCosts = has(COST_VIEWERS, roleStr);
  /**
   * C9 — costo/margen de UNA cotización concreta.
   *
   * Espejo EXACTO de `public.puede_ver_costos_cotizacion_propia()`: el criterio
   * de "cotización propia" es `created_by = usuario actual`, ni el vendedor
   * asignado ni el dueño de la oportunidad. Si cambia la función SQL hay que
   * cambiar esto también.
   */
  const canViewCostsOfCotizacion = (createdBy: string | null | undefined): boolean =>
    puedeVerCostosCotizacion(roleStr, !!createdBy && !!user?.id && createdBy === user.id);

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
  // Ola 6 (O6.3): configuración del CRM — espejo de la policy
  // "Tenant admin crm_etapas_pipeline" (migración 20260821145033).
  const canConfigurarCrm = has(CRM_CONFIG, roleStr);
  // Ola 6 (O6.1): tomar leads de la bolsa — espejo de crm_tomar_lead.
  const canTomarLead = has(CRM_TOMAR_LEAD, roleStr);
  /**
   * v13.823.60 — ownership de leads. La base valida el rol EN la organización
   * del lead y, para vendedor, que `vendedor_id = auth.uid()`; aquí sólo se
   * refleja para no ofrecer acciones que el servidor rechaza.
   */
  const canGestionarTodosLosLeads = has(CRM_GESTION_TODOS_LEADS, roleStr);
  const canGestionarLead = (vendedorId: string | null | undefined): boolean =>
    canGestionarTodosLosLeads ||
    (has(CRM_TOMAR_LEAD, roleStr) && !!vendedorId && !!user?.id && vendedorId === user.id);
  const canCrearLead = has(CRM_CREAR_LEAD, roleStr);
  const canGestionarLeadsEnLote = canGestionarTodosLosLeads;

  return {
    canEdit,
    canEditExpediente,
    canEditCrm,
    canConfigurarCrm,
    canTomarLead,
    canGestionarTodosLosLeads,
    canGestionarLead,
    canCrearLead,
    canGestionarLeadsEnLote,

    isAdmin,
    isSuperAdmin,
    isOperador,
    canViewFinancials,
    canViewCosts,
    canViewCostsOfCotizacion,
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

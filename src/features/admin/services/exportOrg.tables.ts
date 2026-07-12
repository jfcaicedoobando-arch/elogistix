/**
 * Catálogo de tablas exportables por organización.
 *
 * Un único punto de verdad. Excluidas deliberadamente (ver plan 13.287.0):
 *   - facturapi_credenciales (secretos PAC)
 *   - organization_members, agente_users, client_users (control de acceso)
 *   - tracking_intentos, tracking_links, tracking_webhook_log (ruido infra)
 *   - app_logs, idempotency_keys, folio_secuencias, notificaciones_internas
 *   - cotizacion_costos_historico, catalogo_claves_sat (catálogos/logs)
 *   - _backup_*, vistas v_*
 */
export const EXPORT_GROUPS = {
  "Maestros comerciales": [
    "clientes",
    "proveedores",
    "contactos_cliente",
  ],
  "Operación de embarques": [
    "embarques",
    "embarque_contenedores",
    "embarque_garantias_contenedor",
    "eventos_embarque",
    "documentos_embarque",
    "notas_embarque",
    "seguros_embarque",
    "tracking_externo",
    "cierre_embarque_log",
    "conceptos_costo",
    "conceptos_venta",
  ],
  "Cotizaciones y proformas": [
    "cotizaciones",
    "cotizacion_costos",
    "cotizacion_envios",
    "proformas",
    "proforma_conceptos_consolidados",
    "proforma_envios",
  ],
  "Facturación y cobranza": [
    "facturas",
    "conceptos_factura",
    "factura_notas_credito",
    "factura_series",
    "factura_embarques",
    "factura_envios",
    "factura_recordatorios",
    "pagos_factura",
    "cobranza_seguimiento",
    "proveedor_facturas",
    "proveedor_facturas_conceptos",
    "proveedor_notas_credito",
    "pagos_proveedor",
  ],
  "Tesorería": [
    "bbva_movimientos",
    "cuentas_bancarias",
  ],
  "Costeo y tarifas": [
    "costeo_tarifas",
    "costeo_tarifa_recargos",
    "costeo_rutas",
    "costeo_agentes",
    "costeo_navieras_condiciones",
    "costeo_naviera_demoras_tarifa",
    "costeo_demoras_venta_tarifa",
  ],
  "CRM": [
    "crm_leads",
    "crm_oportunidades",
    "crm_actividades",
    "crm_comentarios_oportunidad",
    "crm_etapas_pipeline",
    "crm_motivos_perdida",
    "crm_plantillas_mensaje",
    "crm_cuotas_vendedor",
    "crm_notificaciones",
  ],
  "Comisiones y presupuesto": [
    "comisiones_devengadas",
    "liquidaciones_comision",
    "presupuesto_categorias",
    "presupuesto_mensual",
  ],
  "Auditoría interna": [
    "auditoria_revisiones",
    "auditoria_snapshots",
    "auditoria_comentarios",
  ],
  "Configuración y otros": [
    "configuracion",
    "vendedora_config",
    "notificaciones_cliente",
    "bitacora_actividad",
  ],
} as const satisfies Record<string, readonly string[]>;

export const EXPORT_TABLES = Object.values(EXPORT_GROUPS).flat() as readonly string[];

/** Tablas que NUNCA deben aparecer en el export. Consumido por el test smoke. */
export const FORBIDDEN_EXPORT_TABLES = [
  "facturapi_credenciales",
  "organization_members",
  "agente_users",
  "client_users",
  "app_logs",
  "idempotency_keys",
  "folio_secuencias",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

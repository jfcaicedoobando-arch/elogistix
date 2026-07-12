# Ampliar exportación de datos de la organización

Hoy el ZIP incluye 18 tablas. La base de datos tiene ~70 tablas con `organization_id`. Agregamos ~37 tablas relevantes agrupadas por dominio y excluimos explícitamente las que no deben exportarse.

## Tablas a agregar (por dominio)

**Facturación y cobranza (12)**
`proveedor_facturas`, `proveedor_facturas_conceptos`, `proveedor_notas_credito`, `factura_notas_credito`, `pagos_factura`, `pagos_proveedor`, `factura_series`, `factura_embarques`, `factura_envios`, `factura_recordatorios`, `proforma_envios`, `cobranza_seguimiento`

**Tesorería (2)**
`bbva_movimientos`, `cuentas_bancarias`

**Operación de embarques (5)**
`embarque_contenedores`, `embarque_garantias_contenedor`, `seguros_embarque`, `tracking_externo`, `cierre_embarque_log`

**Costeo / tarifas (6)**
`costeo_tarifas`, `costeo_tarifa_recargos`, `costeo_rutas`, `costeo_agentes`, `costeo_navieras_condiciones`, `costeo_naviera_demoras_tarifa`, `costeo_demoras_venta_tarifa`

**CRM (9)**
`crm_leads`, `crm_oportunidades`, `crm_actividades`, `crm_comentarios_oportunidad`, `crm_etapas_pipeline`, `crm_motivos_perdida`, `crm_plantillas_mensaje`, `crm_cuotas_vendedor`, `crm_notificaciones`

**Comisiones y presupuesto (4)**
`comisiones_devengadas`, `liquidaciones_comision`, `presupuesto_categorias`, `presupuesto_mensual`

**Auditoría interna (3)**
`auditoria_revisiones`, `auditoria_snapshots`, `auditoria_comentarios`

**Otros (2)**
`cotizacion_envios`, `vendedora_config`

## Tablas que **NO** se exportan (y por qué)

- `facturapi_credenciales` — secretos de PAC.
- `organization_members`, `agente_users`, `client_users` — control de acceso, no datos del negocio.
- `tracking_intentos`, `tracking_links`, `tracking_webhook_log` — ruido de infra tracking (opcional a futuro).
- `app_logs`, `idempotency_keys`, `folio_secuencias`, `notificaciones_internas`, `cotizacion_costos_historico`, `catalogo_claves_sat` — logs/estado interno o catálogos globales; inflan el ZIP sin valor de respaldo.
- `_backup_*` — snapshots administrativos.
- Vistas `v_*` — derivadas de tablas ya incluidas.

## Cambios técnicos

1. **`src/features/admin/services/exportOrg.ts`**
   - Reorganizar `EXPORT_TABLES` en secciones comentadas por dominio para mantenimiento claro.
   - Endurecer el loop: si una tabla falla con permiso RLS o no existe (`PGRST205`/`42501`), registrar warning en el manifest y continuar en lugar de abortar todo el export.
   - `buildExportManifest` ahora incluye: cuenta de filas por tabla, lista de tablas con warnings y versión de la app (`APP_VERSION`).
   - Mantener paginación de 1000 filas y firma pública (`fetchOrganizationExport`, `exportOrganizationZip`) — sin romper call-sites.

2. **`src/features/admin/components/TabExportar.tsx`**
   - Agrupar visualmente el listado por dominio (Facturación, Operación, CRM, etc.) en lugar de un blob de texto.
   - Aviso: "Se excluyen credenciales, control de acceso y logs internos".

3. **Tests**
   - `exportOrg.test.ts`: agregar caso de tabla que devuelve error RLS para verificar el flujo "warning + continuar".
   - Test de smoke que asegure que `EXPORT_TABLES` no contiene las tablas prohibidas (`facturapi_credenciales`, `organization_members`, etc.).

4. **Changelog + versión**
   - Bump `APP_VERSION` a `13.287.0` y agregar entrada en `CHANGELOG.md`.

## Verificación final

- `bun run lint --max-warnings 0`
- `bunx vitest run src/features/admin/services/__tests__/exportOrg.test.ts`
- Prueba manual en `/configuracion → Herramientas → Descargar ZIP` con Playwright: confirmar que el ZIP contiene los ~55 CSVs y que `manifest.json` lista conteos por tabla.

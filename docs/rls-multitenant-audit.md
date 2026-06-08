# Auditoría RLS Multitenant — 2026-06-08 (v12.61.11)

Resultado de la auditoría completa de Row-Level Security en `public`.
Complementa `docs/security-checklist.md` y debe reejecutarse al menos
trimestralmente o tras cualquier `CREATE TABLE` en el esquema `public`.

## Patrón canónico

El aislamiento por organización **NO** usa `current_setting('app.current_org_id')`
(eso requeriría que cada request setee un GUC, cosa que el cliente Supabase
no hace). Se usa la función `SECURITY DEFINER`:

```sql
public.current_user_org_id() RETURNS uuid
-- Lee user_organization_members del auth.uid() actual.
```

Toda política multitenant filtra con:

```sql
USING (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
```

El portal cliente usa un patrón distinto pero seguro:

```sql
USING (has_role(auth.uid(), 'cliente') AND cliente_id IN (SELECT current_user_client_ids()))
```

`cliente_id` está atado a una sola organización, así que no se requiere el
filtro adicional de org (y añadirlo rompería el portal porque los contactos
no son miembros de `user_organization_members`).

## Matriz auditada (67 tablas en `public`)

### Tablas de dominio con `organization_id` — 53 ✅

`embarques`, `cotizaciones`, `clientes`, `facturas`, `proformas`,
`conceptos_venta`, `conceptos_costo`, `conceptos_factura`, `cotizacion_costos`,
`documentos_embarque`, `embarque_contenedores`, `eventos_embarque`,
`notas_embarque`, `pagos_factura`, `pagos_proveedor`, `proveedores`,
`proveedor_facturas`, `proveedor_facturas_conceptos`, `proveedor_notas_credito`,
`factura_notas_credito`, `factura_series`, `proforma_conceptos_consolidados`,
`contactos_cliente`, `client_users`, `notificaciones_cliente`,
`crm_leads`, `crm_oportunidades`, `crm_actividades`,
`crm_comentarios_oportunidad`, `crm_cuotas_vendedor`, `crm_etapas_pipeline`,
`crm_motivos_perdida`, `crm_plantillas_mensaje`, `cuentas_bancarias`,
`bbva_movimientos`, `presupuesto_categorias`, `presupuesto_mensual`,
`comisiones_devengadas`, `liquidaciones_comision`, `vendedora_config`,
`auditoria_snapshots`, `auditoria_revisiones`, `auditoria_comentarios`,
`bitacora_actividad`, `app_logs`, `configuracion`, `tracking_links`,
`tracking_intentos`, `tracking_externo`, `organization_members`,
`idempotency_keys`, `_backup_merge_embarques_20260602`.

Todas con RLS activado y al menos una política con filtro por
`organization_id` y/o por `cliente_id` (portal). Casos especiales:

| Tabla | Notas |
|---|---|
| `notificaciones_internas` | **12.61.11**: añadido `AND organization_id = current_user_org_id()` redundante en SELECT/UPDATE |
| `crm_notificaciones` | **12.61.11**: idem |
| `bitacora_actividad` | INSERT con `WITH CHECK (usuario_id = auth.uid())` — validado |
| `app_logs` | Solo admins ven logs de su org |
| Tablas `crm_*` con `vendedora_id` | Doble filtro: org + propiedad del vendedor cuando aplica |

### Tablas sin `organization_id` — 14 (correcto por diseño)

| Tabla | Justificación |
|---|---|
| `puertos`, `navieras`, `tipos_contenedor`, `planes` | Catálogos públicos compartidos (SELECT abierto, INSERT/UPDATE solo super_admin) |
| `configuracion_global` | Config compartida read-only para autenticados |
| `organizations` | Listado controlado por membresía vía `user_organization_members` |
| `user_roles` | Asignaciones globales; lectura vía `has_role()` SECURITY DEFINER |
| `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails` | `service_role` only — accesos exclusivos de edge functions |
| `ratelimit_buckets` | Sin políticas RLS abiertas; acceso solo desde backend |
| `tracking_webhook_log` | Append-only de webhooks externos |
| `alertas_sistema` | Anuncios globales |
| `_backup_merge_fk_remap_20260602` | Snapshot histórico, sin acceso desde la app |

## Cobertura

- 67/67 tablas con RLS activado ✅
- 53/53 tablas con `organization_id` con al menos una política tenant-aware ✅
- 0 tablas con `organization_id` sin filtro de org o cliente_id ✅

## Cómo reauditar

```bash
psql -c "
WITH pub AS (
  SELECT c.relname AS tabla,
    EXISTS (SELECT 1 FROM information_schema.columns ic
            WHERE ic.table_schema='public' AND ic.table_name=c.relname AND ic.column_name='organization_id') AS has_org
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r'
)
SELECT p.tabla, p.has_org,
  (SELECT count(*) FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=p.tabla
     AND pp.cmd IN ('SELECT','ALL')
     AND (pp.qual ILIKE '%current_user_org_id%' OR pp.qual ILIKE '%current_user_client_ids%' OR pp.qual ILIKE '%has_role%' OR pp.qual ILIKE '%deleted_at%' OR pp.qual='true')) AS scoped
FROM pub p WHERE p.has_org AND
  (SELECT count(*) FROM pg_policies pp WHERE pp.schemaname='public' AND pp.tablename=p.tabla
     AND pp.cmd IN ('SELECT','ALL')
     AND (pp.qual ILIKE '%current_user_org_id%' OR pp.qual ILIKE '%current_user_client_ids%')) = 0
ORDER BY p.tabla;"
```

El query debe devolver 0 filas. Si aparece alguna, esa tabla tiene
`organization_id` pero ninguna política lo usa — añadir filtro de tenant
inmediatamente.

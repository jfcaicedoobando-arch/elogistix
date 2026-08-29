# Auditoría RLS Multitenant — 2026-08-29 (v13.793.0)

Resultado de la auditoría de Row-Level Security en el esquema `public`,
verificada contra el estado **vivo** de la base (`pg_class`, `pg_policies`).
Complementa `docs/security-checklist.md` y debe reejecutarse al menos
trimestralmente o tras cualquier `CREATE TABLE` en `public`.

## Números duros (estado vivo)

| Métrica | Valor |
|---|---|
| Tablas en `public` | 119 |
| Tablas con RLS activado | 119 (100 %) |
| Tablas con RLS y **cero** políticas | 0 |
| Políticas totales | 416 |
| Políticas `RESTRICTIVE` | 93, sobre 92 tablas |
| Tablas con `organization_id` | 101 |
| Tablas con `organization_id` sin filtro de tenant | 0 |

## Patrón canónico

El aislamiento por organización **NO** usa `current_setting('app.current_org_id')`
(eso requeriría que cada request setee un GUC, cosa que el cliente Supabase no
hace). Hoy conviven cuatro formas equivalentes y aceptadas de derivar el tenant,
todas `SECURITY DEFINER` o sub-selects sobre la membresía:

1. `current_user_org_id()` — primera membresía del `auth.uid()` actual.
2. `EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = <tabla>.organization_id AND m.user_id = (SELECT auth.uid()))` — patrón preferido en módulos nuevos (costeo, envíos, plantillas).
3. `is_org_admin(auth.uid(), organization_id)` — cuando la lectura es sólo para administradores de la organización (`app_logs`, `role_change_log`).
4. `current_agente_id()` / `current_agente_org()` — portal de agentes de carga.

El portal cliente usa un patrón distinto pero seguro:

```sql
USING (has_role(auth.uid(), 'cliente') AND cliente_id IN (SELECT current_user_client_ids()))
```

`cliente_id` está atado a una sola organización, así que no se requiere el filtro
adicional de org (y añadirlo rompería el portal porque los contactos no son
miembros de `organization_members`).

## Capa RESTRICTIVE (scope de tenant activo)

Desde la ola de hardening multi-tenant, 92 tablas críticas llevan además una
política **RESTRICTIVE**:

```sql
USING ((NOT (SELECT has_role((SELECT auth.uid()), 'super_admin')))
       OR rls_tenant_scope_ok(organization_id))
```

Efecto: un `super_admin` sólo ve/escribe la organización que tiene activa en
`super_admin_org_activa` (Platform Console). Al ser RESTRICTIVE se aplica en
`AND` con las permisivas, así que ninguna política permisiva puede saltarla.

## Optimización de rendimiento (InitPlan)

Las políticas envuelven `auth.uid()` y `has_role(...)` en sub-selects
(`(SELECT auth.uid())`) para que Postgres las evalúe **una vez por query**
(InitPlan) y no una vez por fila. Al escribir una política nueva hay que
respetar ese patrón; de lo contrario el linter de rendimiento la marca.

## Tablas sin `organization_id` — 18 (correcto por diseño)

| Grupo | Justificación |
|---|---|
| `puertos`, `navieras`, `tipos_contenedor`, `planes`, `configuracion_global` | Catálogos/config compartidos: `SELECT` abierto a autenticados, escritura sólo `super_admin` |
| `organizations`, `user_roles`, `user_organization_members` | Se resuelven vía membresía / `has_role()` `SECURITY DEFINER` |
| `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`, `ratelimit_buckets` | `service_role` only — acceso exclusivo de edge functions |
| `tracking_webhook_log` | Append-only de webhooks externos |
| `alertas_sistema` | Anuncios globales |
| Tablas `_backup_*` | Snapshots históricos, sin acceso desde la app |

## Cómo reauditar

Detecta tablas con `organization_id` cuya lectura no filtre por tenant en
ninguna de las cuatro formas aceptadas:

```sql
WITH pub AS (
  SELECT c.relname AS tabla
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND EXISTS (SELECT 1 FROM information_schema.columns ic
                WHERE ic.table_schema = 'public' AND ic.table_name = c.relname
                  AND ic.column_name = 'organization_id')
)
SELECT p.tabla
FROM pub p
WHERE (SELECT count(*) FROM pg_policies pp
       WHERE pp.schemaname = 'public' AND pp.tablename = p.tabla
         AND pp.cmd IN ('SELECT','ALL')
         AND (pp.qual ILIKE '%current_user_org_id%'
           OR pp.qual ILIKE '%current_user_client_ids%'
           OR pp.qual ILIKE '%organization_members%'
           OR pp.qual ILIKE '%is_org_admin%'
           OR pp.qual ILIKE '%current_agente_org%')) = 0
ORDER BY 1;
```

El query debe devolver 0 filas. Complementos:

```sql
-- Tablas con RLS pero sin ninguna política (quedan cerradas y rompen la app)
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p
                  WHERE p.schemaname='public' AND p.tablename=c.relname);

-- Cobertura de la capa RESTRICTIVE de tenant activo
SELECT count(DISTINCT tablename) FROM pg_policies
WHERE schemaname='public' AND permissive='RESTRICTIVE';
```

La suite `supabase/tests/rls/` (ver su `README.md`) cubre estos invariantes en CI.

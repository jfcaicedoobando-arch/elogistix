# Remediación de auditoría multi-tenant (H1, H2, H3)

Cierra los tres hallazgos abiertos de la auditoría con una migración única y aditiva. Sin cambios de UI ni de lógica de negocio.

## H1 · `idempotency_keys` filtrada por organización (media)

Hoy las policies solo comparan `user_id = auth.uid()`. Un `super_admin` que impersona, o un usuario miembro de dos orgs, podría chocar/leer claves entre organizaciones. La tabla ya tiene `organization_id NOT NULL` y existe `public.current_user_org_id()`.

Acciones:
- Reemplazar las 2 policies existentes por un set completo scopeado por org:
  - `SELECT` a `authenticated`: `USING (organization_id = public.current_user_org_id() AND (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin')))`.
  - `INSERT` a `authenticated`: `WITH CHECK (user_id = auth.uid() AND organization_id = public.current_user_org_id())`.
  - `UPDATE` a `authenticated`: `USING` + `WITH CHECK` iguales al `INSERT` (mismo user + misma org).
  - `DELETE`: no se agrega (las claves expiran/rotan por proceso; nadie las borra desde el cliente).
- Mantener `service_role` con acceso total (funciones edge que persisten respuestas).

## H2 · Dropear tablas `_backup_*` (baja, limpieza)

Las 7 tablas no tienen policies y no están referenciadas por código de app. Son respaldos de merges/backfills ya cerrados.

Acciones:
- `DROP TABLE IF EXISTS` de las 7 tablas dentro de la misma migración:
  - `_backup_backfill_proformas_20260706`
  - `_backup_gap_externo_proformas_20260706`
  - `_backup_gap_externo_proformas_20260706_lote2`
  - `_backup_merge_client_users_20260706`
  - `_backup_merge_clientes_20260706`
  - `_backup_merge_embarques_20260602`
  - `_backup_merge_fk_remap_20260602`

Riesgo: nulo — RLS bloqueaba a `anon`/`authenticated` y no hay referencias en `src/`. Si necesitáramos restaurarlas, viven en el historial de migraciones.

## H3 · Convertir policies `TO public` de service_role a `TO service_role` (informativa)

Seis policies en `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails` usan `TO public` con filtro `auth.role() = 'service_role'`. Comportamiento idéntico, pero por higiene pasan a `TO service_role`.

Acciones:
- `DROP POLICY` + `CREATE POLICY` idénticas en cuanto a `USING/WITH CHECK`, cambiando el rol destino.

## Verificación

- Test nuevo `src/lib/__tests__/rls-idempotency-keys-scoped.test.ts`: consulta `pg_policies` (vía snapshot en `supabase/tests/rls/`) para asegurar que las 3 policies (`SELECT`/`INSERT`/`UPDATE`) mencionan `organization_id` y `current_user_org_id`.
- Suite RLS existente `test_rls_isolation.sql`: añadir 4 aserciones que:
  1. usuario de Org A no ve claves de Org B,
  2. no puede insertar con `organization_id` de Org B (falla con RLS),
  3. `super_admin` sin impersonación no ve claves de otra org sin `current_user_org_id`,
  4. mismo `user_id` en dos orgs no colisiona (dos filas conviven).
- Guardrail: extender `no-hardcoded-org-default.test.ts` para que también rechace tablas `_backup_*` (previene reintroducirlas).
- CI completo (`bun run ci:fast`) y `supabase--linter` post-migración.

## Detalles técnicos

Estructura de la migración (una sola llamada):

```text
1. DROP POLICY x2 en idempotency_keys
2. CREATE POLICY SELECT/INSERT/UPDATE (scoped by org) — TO authenticated
3. DROP TABLE IF EXISTS 7 tablas _backup_*
4. DROP + CREATE POLICY x6 en email_* / suppressed_emails con TO service_role
```

- No se toca `service_role`; sigue con `GRANT ALL` implícito por bypass.
- `current_user_org_id()` ya es `SECURITY DEFINER STABLE` — apto para RLS.
- No hay cambios en tipos generados (`src/integrations/supabase/types.ts`) más allá de la eliminación de los tipos de las tablas `_backup_*`.
- `CHANGELOG.md` + bump `APP_VERSION` a `13.301.55` (patch, remediación).

## Fuera de alcance

- No se toca el modelo de folios ni `provision_organization`.
- No se refactoriza el uso de idempotency en edge functions (payload actual sigue siendo compatible; ya envían el `organization_id` correcto).
- No se agregan políticas `DELETE` en `idempotency_keys` (no hay caso de uso desde el cliente).

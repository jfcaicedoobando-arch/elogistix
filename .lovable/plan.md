# Paso 2 — Cerrar backlog de seguridad y cortar `12.0.0-rc.1`

Estamos en `11.71.0` con 770/770 tests verdes y la fase 1 de RC completa. Quedan 4 hallazgos del scanner en `docs/rc-qa-checklist.md §L` que originalmente quedaron como "deuda pre-GA". Propongo cerrarlos **ahora** para que el RC salga limpio (sin deuda de seguridad arrastrada) y luego cortar la etiqueta `12.0.0-rc.1`.

## Alcance

### A. Cerrar los 4 hallazgos de §L (migración + edge function)

1. **`auditoria_snapshots_viewer_access`** — RLS
   Restringir `SELECT` en `auditoria_snapshots` a `admin / super_admin / operador` dentro de su `organization_id`. Quitar acceso a `viewer` y a clientes del portal.

2. **`bitacora_actividad_operador_access`** — RLS
   Reemplazar política actual por una que use `has_role('admin', _user_id)` **scopeada por `organization_id`** (hoy un admin global podría ver bitácoras de otra org si la política no filtra). Mantener INSERT vía SECURITY DEFINER.

3. **`tracking_intentos_no_role_restriction`** — RLS
   Restringir `SELECT` e `INSERT` en `tracking_intentos` a `admin / super_admin / operador` de la organización dueña del embarque. Viewer y portal bloqueados.

4. **`client_error_log_abuse`** — Edge function `client-error-log`
   - Validar JWT con `getClaims` (usar `_shared/auth.ts → authenticate`).
   - Rate limit en memoria por `userId + IP`: 30 eventos / 60s; exceso → 429.
   - Loggear `userId` real en lugar de confiar en el payload.

### B. Verificación

- Migración: `supabase--linter` después de aplicar → 0 nuevos hallazgos.
- `security--run_security_scan` → los 4 IDs ya no aparecen.
- Tests RLS: `bunx vitest run rls` + `supabase/tests/rls/test_rls_isolation.sql` en Test.
- `bunx vitest run` → mantener 770/770 (o más si se añaden cases).
- Smoke manual rápido: viewer no ve auditoría/bitácora/tracking; admin sí; cliente del portal sigue funcionando.

### C. Corte de RC

Una vez verde:

1. Bump a **`12.0.0-rc.1`** en `src/constants/appVersion.ts`.
2. Entrada en `CHANGELOG.md` (`## [12.0.0-rc.1] - 2026-05-27`) con resumen de los 4 fixes + referencia a la fase 1.
3. Entrada en `src/pages/Changelog.tsx` (al inicio del array, formato existente).
4. Actualizar `docs/rc-qa-checklist.md §L` marcando los 4 como ✅.
5. Actualizar `docs/release-notes-12.0.md` con la nota de los fixes.
6. Marcar en `@security-memory` la política aplicada (no agregar lista de findings abiertos).

## Fuera de alcance (deferido a GA o 12.1.x)

- Ejecutar el QA manual end-to-end (`§A-J`) — requiere persona, no agente.
- Performance smoke con dataset realista — requiere dataset.
- Rollback dry-run en Test — requiere ventana de operación.
- 38 funciones con CC 13-15 y 421 casts MEDIUM en `lib/mappers/*` (deuda aceptable).

## Detalle técnico

**Migración (un solo archivo):**

```sql
-- 1. auditoria_snapshots
DROP POLICY IF EXISTS "viewer_read_auditoria_snapshots" ON public.auditoria_snapshots;
CREATE POLICY "staff_read_auditoria_snapshots" ON public.auditoria_snapshots
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'operador')
    )
  );

-- 2. bitacora_actividad (reescribir SELECT scopeado)
DROP POLICY IF EXISTS "admins_read_bitacora" ON public.bitacora_actividad;
CREATE POLICY "org_staff_read_bitacora" ON public.bitacora_actividad
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'operador')
    )
  );

-- 3. tracking_intentos
ALTER TABLE public.tracking_intentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all_read_tracking_intentos" ON public.tracking_intentos;
CREATE POLICY "staff_rw_tracking_intentos" ON public.tracking_intentos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.id = embarque_id
        AND e.organization_id = public.current_user_organization_id()
    )
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'operador')
    )
  )
  WITH CHECK (...mismo...);
```

(Los nombres exactos de políticas existentes se leerán antes de migrar.)

**Edge function `client-error-log/index.ts`:**

- Importar `authenticate` de `_shared/auth.ts`.
- Mapa en memoria `Map<string, number[]>` (timestamps) con limpieza por ventana de 60s.
- Si `requests.length >= 30` → `429`.

## Archivos a tocar

- `supabase/migrations/<timestamp>_rc_security_hardening.sql` (nuevo)
- `supabase/functions/client-error-log/index.ts`
- `src/constants/appVersion.ts` → `12.0.0-rc.1`
- `CHANGELOG.md`
- `src/pages/Changelog.tsx`
- `docs/rc-qa-checklist.md`
- `docs/release-notes-12.0.md`
- `@security-memory` (actualizar)

## Criterio de aceptación

- `supabase--linter` y `security--run_security_scan` sin los 4 IDs.
- 770/770 tests verdes.
- `APP_VERSION === "12.0.0-rc.1"` y aparece en ambos changelogs.
- §L del checklist marcada como cerrada.

¿Aprobamos para implementar?

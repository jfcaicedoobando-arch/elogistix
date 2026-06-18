## Problema

El usuario con rol `contador` cae en `/inicio` y `useAppSidebarSections` invoca `useAuditoriaCount()` incondicionalmente. El RPC `auditoria_embarques_org` responde 403 por RLS (sólo admin/admin_org/super_admin tienen acceso), React Query lo propaga al `QueryCache.onError` y se reporta a Sentry como issue `wq` (`feature: react_query, kind: query`). El badge ni siquiera se muestra para este rol porque `/auditoria` está filtrado del sidebar.

Hallazgos relacionados en los breadcrumbs: dos llamadas a `auditoria_embarques_org` con 403, y otra similar a `auditoria_revisiones` (200, pero también innecesaria para roles sin acceso).

## Cambios

1. **`src/features/auditoria/hooks/useAuditoria.ts`**
   - Aceptar opción `{ enabled?: boolean }` en `useAuditoria()` y `useAuditoriaCount()`.
   - Propagar `enabled` tanto al query del reporte como al de revisiones dentro de `useQueries`.
   - Cuando `enabled === false`, ambos queries quedan deshabilitados y el hook devuelve `{ data: undefined, isLoading: false, isError: false, error: null }` sin disparar fetch.

2. **`src/hooks/layout/useAppSidebarSections.ts`**
   - Calcular `canVerAuditoria = effectiveRole === "admin" || effectiveRole === "admin_org" || role === "super_admin"` (mismo criterio que decide si `/auditoria` aparece en el sidebar).
   - Llamar `useAuditoriaCount({ enabled: canVerAuditoria })`.
   - Mantener el mapeo del `badgeCount` sin cambios (cuando está deshabilitado, `auditoriaCount` cae al default `0`).

3. **`src/hooks/layout/__tests__/useLayout.test.tsx`** (si el mock lo requiere)
   - Ajustar el mock de `useAuditoriaCount` para aceptar el nuevo argumento opcional sin romper aserciones existentes.

4. **`CHANGELOG.md` + `src/constants/appVersion.ts`**
   - Nueva entrada `[13.66.22]` describiendo el gating del badge de auditoría para roles sin acceso y el efecto en Sentry (elimina 403 ruidosos).

## Fuera de alcance

- No tocar la política RLS del RPC (el 403 server-side sigue siendo la última línea de defensa).
- No modificar otros hooks que consulten endpoints de auditoría desde rutas ya protegidas (`/auditoria` ya está gated por el router).
- No cambiar el matriz de roles ni la visibilidad del item de sidebar.

## Verificación

- `bunx vitest run src/hooks/layout src/features/auditoria/hooks`
- Lint sobre los dos archivos editados.
- Recuento manual: con rol `contador`, no debe haber request a `auditoria_embarques_org` ni a `auditoria_revisiones` al cargar `/inicio`.

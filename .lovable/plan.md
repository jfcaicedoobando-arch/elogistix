## Hallazgos del dashboard de Sentry (últimas 24h)

Tres issues nuevas, sólo una requiere fix de código:

### 🔴 Issue 16 — `permission denied for function current_user_org_id` (CXP, 4 eventos)
- **Causa**: la función `public.current_user_org_id()` es `SECURITY DEFINER` pero **nunca se le otorgó `EXECUTE`** a ningún rol. PostgREST la invoca desde RLS de `facturas`/`proveedor_facturas`; cuando un cliente no autenticado (o con sesión expirada) consulta CXP, el motor explota antes de evaluar la política.
- **Síntoma adicional en el evento**: `url: librecarga.com/login`, `effective_role: none` → React Query corrió la consulta de CXP en una pestaña sin sesión.

### 🟡 Issues 17 y 18 — `AbortError: Lock broken by another request with the 'steal' option.`
- **Causa**: Web Locks API del cliente Supabase cuando hay múltiples pestañas. Es comportamiento esperado del refresh del token; no representa un bug en la app.
- Sin stacktrace propio, no se puede actuar; lo correcto es **silenciarlo** en `ignoreErrors`.

## Cambios

### 1. Migración SQL — `GRANT EXECUTE` defensivo

```sql
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM anon, public;
```

Con esto, sesiones autenticadas legítimas dejan de romper; las llamadas anónimas siguen bloqueadas (correcto) pero sin spamear Sentry.

### 2. `src/lib/observability/sentry/core.ts` — añadir patrones a `ignoreErrors`

```ts
/AbortError: Lock broken by another request/i,
/permission denied for function current_user_org_id/i, // ya cubierto por GRANT, doble red
```

(El segundo patrón se puede quitar después si confirmamos que el GRANT eliminó el ruido.)

### 3. Versionado + changelog
- `APP_VERSION` → `13.106.5`
- Entrada `[13.106.5]` en `CHANGELOG.md` describiendo ambos arreglos.

## Verificación

1. Tras la migración, ejecutar `select public.current_user_org_id();` como rol `authenticated` (no debe fallar por permisos).
2. Recargar `/cxp` autenticado y confirmar que la lista carga sin errores nuevos en Sentry.
3. Abrir dos pestañas y refrescar; el `AbortError` debe seguir ocurriendo en consola pero **no** llegar a Sentry.

## Fuera de alcance

- Resolver/cerrar las 3 issues en el dashboard de Sentry — sugiero cerrarlas a mano después de desplegar para verificar que no reaparecen.
- No se cambia la lógica de auth ni el query client; sólo permisos y filtros de telemetría.

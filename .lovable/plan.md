## Objetivo
Crear una nueva pantalla `/sentry` que muestre el estado de Sentry, la versión del release, el usuario autenticado y la organización activa. Útil para verificar en runtime que el reporte de errores está funcionando.

## Cambios

### 1. Nueva página — `src/pages/dashboard/SentryDiagnostico.tsx`
Una pantalla de solo lectura con tarjetas de información:
- **Estado de Sentry**: activo/inactivo (detectado vía `Sentry.getClient()`), con indicador visual verde/rojo.
- **Release**: `libre-carga@${APP_VERSION}`.
- **Environment**: `import.meta.env.MODE` (development/production).
- **DSN**: mostrado parcialmente enmascarado por seguridad (solo el host y los últimos 6 caracteres del key).
- **Sample rate**: `tracesSampleRate`.
- **Usuario actual**: email, id, rol efectivo.
- **Organización actual**: nombre, id.
- **Acción**: botón "Enviar error de prueba" que dispara `Sentry.captureException(new Error("Error de prueba — Sentry Diagnóstico"))` y muestra confirmación con toast.

Estilo: reutilizando `PageHeader`, `Card`, `CardContent` y layout de grid (2 cols en desktop, 1 en mobile) para mantener consistencia con el panel de salud en `/admin/diagnostico`.

### 2. Ruta — `src/App.tsx`
Agregar lazy import y ruta `/sentry` dentro del bloque de rutas regulares (`<ProtectedRoute><Layout /></ProtectedRoute>`).

### 3. Sidebar — `src/components/layout/sidebarItems.ts`
Agregar item `"Sentry"` con url `/sentry` e icono `Bug` en `SIDEBAR_SISTEMA_ITEMS`, junto a Changelog y Ayuda.

### 4. Changelog — bump a v10.2.5
Actualizar `appVersion.ts`, `changelogData.ts` y `v8/chunks/0.ts` con entrada:
> v10.2.5 — Agrega pantalla de diagnóstico de Sentry (`/sentry`) para verificar estado del SDK, release, usuario y organización en runtime.

## Técnico
- Se consume `useAuth()` y `useOrganization()` para usuario/org.
- Se importa `* as Sentry` para leer el cliente y disparar el test error.
- Se importa `APP_VERSION` de `@/constants/appVersion`.
- No se requieren cambios de backend ni RLS.
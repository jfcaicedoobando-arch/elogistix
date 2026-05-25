# Fix: ruido de Sentry por "Failed to fetch dynamically imported module"

## Contexto

Issue Sentry `JAVASCRIPT-REACT-5` — 201 eventos, 2 usuarios, regresado. Es el error transitorio que ocurre cuando una pestaña vieja intenta cargar un chunk de página (`Cotizaciones.tsx`, `Facturacion.tsx`, `Embarques.tsx`, etc.) cuyo hash ya cambió tras un nuevo build. La app **ya se auto-recupera** (vía `vite:preloadError` y `ErrorBoundary`), pero:

1. El rechazo también se reporta a Sentry como `unhandledrejection`, generando ruido (199 de las 201 ocurrencias).
2. En algunos casos el evento `vite:preloadError` no se dispara (el fallo viene del `import()` de `React.lazy`, no del preload), así que dependemos solo del ErrorBoundary para recargar — y eso requiere que React llegue a renderizar el error.

## Cambios

### 1. `src/lib/sentry.ts` — filtrar chunk errors en `beforeSend`

Agregar `beforeSend` que descarte eventos cuyo `exception.values[*].value` o `message` contenga las firmas conocidas:

- `Failed to fetch dynamically imported module`
- `Importing a module script failed`
- `error loading dynamically imported module`
- `Loading chunk` / `ChunkLoadError`

Devolver `null` para esos eventos. No afecta otros errores ni el widget de feedback.

### 2. `src/main.tsx` — listener global `unhandledrejection`

Agregar un listener que reuse la misma lógica que ya tiene `vite:preloadError`:

- Si `event.reason` es un Error cuyo mensaje matchea las firmas de chunk-load → `event.preventDefault()`, marcar flag, `window.location.reload()` (una sola vez gracias a `hasChunkReloadBeenAttempted`).

Reutilizar el helper `isDynamicImportError` que ya existe en `ErrorBoundary.tsx` extrayéndolo a `src/lib/ui/dynamicImportError.ts` para no duplicar lógica.

### 3. `src/components/shared/ErrorBoundary.tsx`

Reemplazar la copia local de `isDynamicImportError` por el import del helper compartido. Sin cambios de comportamiento.

### 4. Resolver el issue en Sentry

Tras el deploy, marcar `JAVASCRIPT-REACT-5` como `resolvedInNextRelease` vía `update_issue`.

### 5. Changelog

Bump `APP_VERSION` a `11.30.1` (patch) + entrada en `CHANGELOG.md` raíz:
`Sentry: filtradas excepciones transitorias de carga de chunks; auto-recarga reforzada en unhandledrejection.`

## Lo que NO se cambia

- Sigue habiendo recarga automática real (el usuario nunca queda atascado).
- No tocamos config de Vite, manualChunks, ni el flujo de `React.lazy`.
- No suprimimos ningún otro tipo de error en Sentry.

## Verificación

- `npm run lint` → 0 warnings.
- `vitest run` → 621/621 verdes.
- Confirmar en `/sentry` que el panel sigue funcionando y que un error de prueba (`Enviar error de prueba`) **sí** llega a Sentry (el filtro solo aplica a chunk-load).

# Plan: error "Failed to fetch dynamically imported module" (preview, 13.823.249)

## Diagnóstico (verificado en código)

El error ocurre cuando el navegador tiene cargada una versión vieja de la app y pide un módulo
(`ClienteDetalle.tsx?t=...`) que el servidor ya reemplazó tras publicar una versión nueva. Es
transitorio y se cura solo con recargar.

Protecciones que YA existen y funcionan:

1. `src/main.tsx` escucha `vite:preloadError`, `unhandledrejection` y `error` global; al detectar
   esta firma llama `tryReloadForChunkError()` que recarga la página una sola vez por sesión.
2. `src/lib/observability/sentry/initOptions.ts` ignora el mensaje (`/Failed to fetch dynamically
   imported module/i`, línea 40) — por eso el reporte del usuario muestra **"(sin ID)"**: el evento
   nunca llegó a Sentry. No hay issue que resolver allí.

Conclusión: no es un bug del ERP; es el mecanismo de auto-recuperación actuando en el preview.
El usuario sólo percibe una recarga silenciosa (o el error en consola) sin entender qué pasó.

## Cambio propuesto (pulido mínimo, YAGNI)

1. **Aviso visible antes de recargar**: en `tryReloadForChunkError` mostrar un aviso tipo
   "Hay una versión nueva, actualizando…" (~1 s) antes del `location.reload()`, para que el
   usuario entienda la recarga en vez de ver un parpadeo sin explicación.
   - Implementación: un overlay mínimo inyectado en el DOM desde `src/lib/errors/dynamicImportError.ts`
     (sin React, sin dependencias nuevas), removido automáticamente al recargar.
2. **Guarda anti-bucle con ventana de tiempo**: hoy la bandera de "ya recargué" se limpia a los 8 s
   de `load`, así que una pestaña muy vieja podría entrar en bucle si el servidor sigue sirviendo
   módulos inconsistentes. Cambiar la guarda a: máximo 2 recargas por chunk en 2 minutos; al
   tercer fallo mostrar el fallback de arranque con botón "Recargar" en lugar de recargar en automático.
3. **Regresiones** (tests focalizados, se ejecutan en GitHub Actions, no localmente):
   - overlay se muestra antes del reload;
   - segunda ocurrencia dentro de la ventana no recarga y muestra fallback.

## Fuera de alcance

- No se tocan rutas, lazy imports, ni la configuración de Vite/Sentry.
- Sin migraciones, sin cambios de datos, sin publicar.
- No se reintentan otros mensajes ya ignorados en Sentry.

## Validación local (rápida, según política)

Typecheck + ESLint focalizados en archivos tocados + build. CI/RLS/Vitest/E2E completos quedan
para GitHub Actions. Bump de versión + CHANGELOG + manifest con `audit:manifest`.

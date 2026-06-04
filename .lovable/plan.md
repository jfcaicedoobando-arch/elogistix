## Problema

`src/lib/sentry.ts` solo inicializa Sentry si `import.meta.env.VITE_SENTRY_DSN` tiene valor. En el build publicado esa variable no existe, así que `initSentry()` retorna temprano y `SentryDiagnostico` muestra "no inicializado".

## Solución

Hardcodear el DSN del proyecto `elogistix/javascript-react` directamente en `src/lib/sentry.ts` (el DSN es una clave pública, segura para el bundle), manteniendo `VITE_SENTRY_DSN` como override opcional para entornos alternos.

DSN a usar:
`https://e44f92892772533298354b89d9ef3ddb@o4511415732404224.ingest.us.sentry.io/4511415734108160`

## Cambios

1. **`src/lib/sentry.ts`**
   - Reemplazar:
     ```ts
     const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
     ```
     por:
     ```ts
     const DEFAULT_DSN = "https://e44f92892772533298354b89d9ef3ddb@o4511415732404224.ingest.us.sentry.io/4511415734108160";
     const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN;
     ```
   - Mantener el guard que evita inicializar en `mode === "development"` (sigue silenciando ruido de HMR local).
   - Actualizar el JSDoc del archivo para reflejar que el DSN tiene fallback hardcodeado.

2. **`src/constants/appVersion.ts`** → bump a `12.51.16`.

3. **`CHANGELOG.md`** → entrada `## [12.51.16] - 2026-06-04`: "Hardcoded Sentry DSN público para inicializar el SDK en builds publicados (antes requería `VITE_SENTRY_DSN` que no estaba definida)."

## Validación

- Tras publicar, abrir `/dashboard/sentry-diagnostico` → debe mostrar Sentry activo, DSN enmascarado, release `libre-carga@12.51.16`, environment `production`.
- En dev no cambia nada (sigue desactivado a propósito).

## Fuera de alcance

- No se toca `vite.config.ts` (el `sentryVitePlugin` para source maps sigue dependiendo de `SENTRY_AUTH_TOKEN`, que es un build secret separado).
- No se mueve el DSN a `.env` (decisión del usuario: hardcode).

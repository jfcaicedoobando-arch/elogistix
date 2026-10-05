# Subir la versión a 13.824.29

## Qué se hará
- Subir la versión de la app de 13.824.28 a 13.824.29.
- En el CHANGELOG, mover la corrección de adjuntos de pricing a una sección nueva: `## [13.824.29] - 2026-10-05`.
- La sección 13.824.28 queda solo con las correcciones de Sentry.
- No se publica la app.

## Detalles técnicos
- Archivos: `src/constants/appVersion.ts` (APP_VERSION) y `CHANGELOG.md`.
- Validación: la app debe compilar. CI completo queda pendiente en GitHub Actions.

# Quitar la excepción obsoleta de tamaño (GrupoCostosProveedor)

CI falla en 1 prueba: `src/lib/__tests__/architecture-baseline.test.ts`. La lista de
excepciones de archivos grandes seguía incluyendo un archivo que ya mide 179 líneas
(máximo permitido: 200). El propio guardián pide retirar entradas obsoletas.

## Cambio (mínimo, sólo las listas)

1. `src/lib/__tests__/architecture-baseline.test.ts`: quitar
   `src/features/embarques/components/costos/GrupoCostosProveedor.tsx` de
   `OVERSIZED_BASELINE` (quedan las otras tres entradas, todas aún > 200 líneas,
   verificado: 255, 207 y 202).
2. `src/__tests__/audit-report.test.ts`: quitar la misma entrada de su
   `OVERSIZED_BASELINE` (los comentarios de ambos archivos exigen mantenerlas
   sincronizadas).

Sin cambios de código productivo, sin cambios de comportamiento, sin migraciones.

## Cierre

- Bump `APP_VERSION` + entrada en `CHANGELOG.md`.
- Validaciones focalizadas: `bunx vitest run src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts`,
  typecheck y `bun run audit:manifest` si aplica.
- CI/RLS/E2E completos quedan para GitHub Actions.

## Objetivo
Dejar `bun run lint:unused` (knip) sin errores ni hints.

## Cambios

### 1. Eliminar código muerto
- Borrar archivo `src/constants/queryStaleTime.ts` (no se importa en ningún lado).
- En `src/constants/cotizacionTerrestre.ts`: eliminar `type ModalidadEquipoTerrestre` y la función `requiereTresPuntos` (sin consumidores).
- En `src/constants/proveedorConstants.ts`: eliminar `function labelCategoria`, `type MetodoPagoProveedor` y `type OrigenProveedor` (el `OrigenProveedor` que se usa vive en `pagoProveedorHelpers.ts`, es independiente).

### 2. Limpiar `knip.json` según los hints
- Quitar `src/integrations/supabase/client.ts` de `ignore` (knip ya lo detecta como entry o usado).
- Quitar `supabase/**` y `docs/**` de `ignore` (no están en `project`).
- Quitar `tailwindcss-animate` y `@tailwindcss/typography` de `ignoreDependencies` (ya se resuelven).
- Quitar de `entry` los patrones redundantes que ya están cubiertos por `project` + auto-detección: `src/main.tsx`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`. Conservar `index.html`, `scripts/**/*.ts` y los patrones de tests.

### 3. Versionado y changelog
- Bump `APP_VERSION` en `src/constants/appVersion.ts` → `13.21.8`.
- Añadir entrada `## [13.21.8] - 2026-06-15` en `CHANGELOG.md` (root) describiendo la limpieza.

## Validación
- `bun run lint:unused` (knip) sin errores ni hints.
- `bun run lint` sigue en verde.
- Suite de tests sigue 2855/2855.

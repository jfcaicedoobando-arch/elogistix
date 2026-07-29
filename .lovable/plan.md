## Qué está fallando en CI (verificado en los logs y reproducido local)

1. **Knip (unused files)** — marca 4 barrels como archivos no usados:
   `src/features/proformas/index.ts`, `proformas/domain/index.ts`, `proformas/hooks/index.ts`, `src/features/tesoreria/index.ts`.
   Son barrels públicos intencionales del piloto O4 (los deep imports están bloqueados por `feature-barrel-surface.test.ts`), no código muerto: nadie los importa todavía porque el burn-down sigue en curso.

2. **Arquitectura (Power of 10 #4)** — reproducido local con `scripts/audit-architecture.ts`:
   `src/features/onboarding/routes/Onboarding.tsx` tiene 203 líneas (límite 200). Creció con el bloque `<Seo>` del fix de SEO. Rompe dos tests: `architecture-baseline.test.ts` y `audit-report.test.ts`.

3. **Tests shard 7/10** — `src/lib/observability/hooks/__tests__/useSentry.test.tsx`:
   `expected ['disabled_dev','missing_dsn'] to include 'pending'`. En CI sí existe `VITE_SENTRY_DSN`, así que el hook (con el poll nuevo de 13.331.8) arranca en `pending` antes de que cargue el SDK diferido. El test asume un entorno sin DSN.

## Cambios propuestos

### A. Knip
En `knip.json`, añadir los barrels raíz de feature como entradas del grafo:
```json
"entry": [..., "src/features/*/index.ts"]
```
Esto también resuelve `proformas/domain/index.ts` y `proformas/hooks/index.ts`, porque el barrel raíz los re-exporta.

### B. Onboarding por debajo de 200 líneas
Extraer la UI del formulario a `src/features/onboarding/components/OnboardingForm.tsx` (campos RFC / dirección / moneda + botones + alerta de error, recibiendo estado y handlers por props) y dejar `Onboarding.tsx` como ruta delgada: guardas de sesión, `<Seo>`, `Card` y la lógica de `submit`. Objetivo: ruta ~110 líneas, componente ~95.

### C. Test de Sentry independiente del entorno
Reescribir el caso "sin cliente" para que valide el contrato real: cuando `getClient()` devuelve `undefined`, `active === false` y el estado es uno de `disabled_dev | missing_dsn | pending` (nunca `active`). Añadir asserts explícitos de que `pending` sólo aparece cuando hay DSN configurado, para no perder cobertura.

### D. Cierre
Actualizar `CHANGELOG.md` y subir `APP_VERSION` a `13.331.10`.

## Verificación
- `bunx tsx scripts/audit-architecture.ts` → 0 oversized.
- `bunx vitest run src/lib/observability src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts`.
- `bunx knip --strict` sin unused files.

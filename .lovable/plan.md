
## Diagnóstico

- `dependency_scan`: **0 vulnerabilidades** high/critical.
- `npm-check-updates` reporta ~60 paquetes con versiones nuevas, pero la mayoría son **majors con breaking changes** que romperían la app si los actualizamos sin un proyecto dedicado.

## Estrategia: 2 olas

Analogía: como cambiar el aceite del coche (rutina, sin riesgo) vs. cambiar el motor entero (es otro proyecto). Esta vez sólo hacemos lo primero.

### Ola 1 — Aplicar ahora (minor + patch, bajo riesgo)

Sólo bumps dentro del mismo major. Cubiertos por nuestros tests y CI.

- Radix UI completo (`@radix-ui/react-*`): patches/minors
- `@sentry/react` 10.53 → 10.62
- `@supabase/supabase-js` 2.98 → 2.108
- `@tanstack/react-query*` 5.83 → 5.101 (+ persisters + virtual)
- `@playwright/test` 1.60 → 1.61
- `@hookform/resolvers` 3 → 5 *(revisar: aunque es major, el cambio es sólo de empaquetado ESM; si rompe tipos lo dejo en ola 2)*
- `react-hook-form` 7.61 → 7.80
- `libphonenumber-js`, `papaparse`, `postcss`, `autoprefixer`, `terser`, `tsx`, `lovable-tagger`, `knip`, `typescript-eslint`, `@testing-library/jest-dom`

Pasos:
1. `bunx npm-check-updates -u --target minor` + agregar `@hookform/resolvers` y los radix manualmente.
2. `bun install`
3. Verificar: `bun run lint`, `bunx tsgo --noEmit`, `bun run test` (subset rápido), build.
4. Si algo falla → revertir ese paquete puntual y documentar.
5. Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

### Ola 2 — Diferidos (majors, requieren proyecto separado)

Cada uno requiere migración manual significativa, NO se tocan hoy:

- **React 18 → 19** (+ `@types/react`, `react-dom`): cambios en JSX runtime, hooks, `useFormState` etc. Toca toda la app.
- **Vite 5 → 8** + **@vitejs/plugin-react-swc 3 → 4**: cambios de config y plugins.
- **Tailwind 3 → 4**: nueva sintaxis CSS-first, hay que reescribir `tailwind.config.ts` y tokens.
- **Zod 3 → 4**: API rota en schemas (`z.string().email()` etc.), afecta todos los formularios.
- **react-router-dom 6 → 7**: nuevo data router.
- **recharts 2 → 3**: cambios de props en gráficos del dashboard.
- **sonner 1 → 2**, **lucide-react 0.462 → 1.21**, **date-fns 3 → 4**, **react-day-picker 8 → 10**: breaking en componentes muy usados.
- **ESLint 9 → 10**, **eslint-plugin-react-hooks 5 → 7**, **vitest 3 → 4**, **@vitest/coverage-v8 3 → 4**, **typescript 5 → 6**, **jsdom 20 → 29**, **tailwind-merge 2 → 3**, **globals 15 → 17**, **@types/node 22 → 26**, **@eslint/js 9 → 10**.

Para cada uno se haría un PR aparte siguiendo su guía oficial de migración.

## Entregable de esta tarea

Sólo la **Ola 1**: instalar, validar lint/tipos/tests/build, y actualizar `CHANGELOG.md` + `APP_VERSION`. Si algún paquete de la lista rompe la build, lo excluyo y lo reporto.

¿Apruebas que ejecute la Ola 1?

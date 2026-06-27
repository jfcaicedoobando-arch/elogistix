
## Contexto

Quedan ~15 dependencias en versión mayor nueva. Cada major es un proyecto aparte: rompe APIs, tipos o sintaxis y exige migración manual + validación visual. La regla es **un major por PR**, en el orden que minimiza retrabajo (las herramientas de build/test antes que el código de la app, y React al final porque arrastra a todo).

Analogía: vamos a remodelar la casa cuarto por cuarto. Primero las herramientas del taller (ESLint, TS, Vitest), luego los muebles aislados (Zod, date-fns, sonner, lucide, recharts), después la plomería estructural (Vite, Tailwind, react-router), y al final el cambio del cableado eléctrico de toda la casa (React 19).

## Orden propuesto (7 PRs)

### PR-A — Toolchain de tests y lint (bajo riesgo, no toca UI)
- `vitest` 3 → 4 + `@vitest/coverage-v8` 4 + `jsdom` 20 → 29
- `eslint` 9 → 10 + `@eslint/js` 10 + `eslint-plugin-react-hooks` 5 → 7 + `globals` 15 → 17 + `eslint-plugin-react-refresh` 0.4 → 0.5
- `@types/node` 22 → 26

Riesgo: medio. Vitest 4 cambia reporters/coverage; eslint-plugin-react-hooks 7 marca nuevos hooks rule-of-hooks. Mitigación: correr `audit:tests`, todas las shards y `bun run lint --max-warnings 0`.

### PR-B — TypeScript 6
- `typescript` 5.8 → 6.0 + `typescript-eslint` 8 → última
- Habilitar gradualmente flags nuevos si los hay.

Riesgo: medio-alto. Posibles errores nuevos de narrowing y `useUnknownInCatchVariables`. Mitigación: `bunx tsgo --noEmit` + corregir un archivo a la vez.

### PR-C — Zod 4
- `zod` 3.25 → 4.x

Cambios: `z.string().email()` → `z.email()`, `z.record(v)` → `z.record(k,v)`, errores en formato `ZodError.issues`. Afecta TODOS los schemas (formularios + edge functions).

Riesgo: alto. Mitigación: usar codemod oficial `npx zod-codemod`, revisar `src/**/schemas/**` y mapeadores de error (`traducirErrorPassword`, `pagosProveedorErrors`).

### PR-D — Componentes UI puntuales (paralelizables tras PR-C)
Cada sub-PR independiente:
- `sonner` 1 → 2: nueva API `toast()`; reescribir `src/lib/notify.ts` y wrappers.
- `lucide-react` 0.462 → 1.21: cambios de nombres de íconos y tamaños default; correr grep masivo.
- `date-fns` 3 → 4: cambios en `parse`, `format` con TZ; revisar `src/lib/date/` y `dateUtils.ts`.
- `react-day-picker` 8 → 10: requiere `date-fns` 4; reescribir `DatePickerMx`/`DateTimePickerMx`/`MonthPickerMx`.
- `recharts` 2 → 3: props de `<XAxis>`, `<Tooltip>` cambian; afecta dashboards (Operations, CRM, KPIs fiscales).
- `tailwind-merge` 2 → 3 + `@hookform/resolvers` 3 → 5: drop-in con verificación de tipos.

Riesgo: medio cada uno; alto si se combinan. Mitigación: un PR por paquete, screenshots antes/después.

### PR-E — Vite 8 + plugin SWC 4
- `vite` 5 → 8 + `@vitejs/plugin-react-swc` 3 → 4 + `lovable-tagger` 1.1 → 1.3

Cambios: nueva resolución de imports, dropped CJS, posibles ajustes en `vite.config.ts` (alias, plugins, env vars).

Riesgo: medio-alto. Mitigación: validar build, dev server, preview, y Playwright contra rutas críticas (login, dashboard, embarques, facturación).

### PR-F — Tailwind 4
- `tailwindcss` 3.4 → 4.x + `autoprefixer` (ya no necesario, lo absorbe Tailwind)

Tailwind 4 es **CSS-first**: `tailwind.config.ts` se reemplaza por `@theme` en CSS. Hay que migrar tokens (`mem://design/color-tokens`, brand assets) a la nueva sintaxis. Soporte directo de CSS Cascade Layers; container queries y `@starting-style` nativos.

Riesgo: alto. Mitigación: usar upgrade tool oficial `npx @tailwindcss/upgrade`, comparar visualmente cada layout (sidebar, FormDialogShell, tablas, login).

### PR-G — react-router-dom 7
- `react-router-dom` 6 → 7

Si seguimos en modo "Library" (sin framework), la migración es muy ligera: la v7 es básicamente v6.4+ con cambios de empaquetado. Hay future flags ya estables.

Riesgo: bajo si no adoptamos framework mode. Mitigación: activar primero `future.v7_*` flags en v6 (si quedan), luego subir.

### PR-H — React 19 (último, el más invasivo)
- `react` 18 → 19 + `react-dom` 19 + `@types/react` 19 + `@types/react-dom` 19

Cambios clave:
- `forwardRef` ya no necesario (ref como prop). Migración manual o codemod.
- Nuevos hooks: `use()`, `useFormStatus`, `useActionState`.
- Cambios en hidratación y Strict Mode (doble efecto sigue, pero comportamiento de refs cambia).
- Compatibilidad con librerías terceras (Radix, react-hook-form, recharts) — por eso va al final, cuando ya están en sus majors.

Riesgo: muy alto. Mitigación: codemod oficial `npx codemod@latest react/19/migration-recipe`, suite completa de tests + Playwright en rutas críticas con `LOVABLE_BROWSER_AUTH_STATUS=injected`.

## Reglas para cada PR

1. Una rama por PR, un major a la vez.
2. Antes de empezar: leer changelog/migration guide oficial del paquete.
3. Después de actualizar: `bun install` → `tsgo --noEmit` → `bun run lint --max-warnings 0` → `bun run test` → build → smoke test visual (Playwright en login + 3 rutas críticas).
4. Si rompe algo no resoluble en <30 min, revertir y reabrir como spike.
5. Bump `APP_VERSION` (minor: `13.138.x`) y entrada en `CHANGELOG.md` por cada PR.
6. NO combinar dos majors en el mismo PR salvo que uno sea prerequisito directo (ej. `date-fns 4` + `react-day-picker 10` van juntos por dependencia).

## Entregable de esta tarea

Sólo el plan. La ejecución sería en sesiones futuras, **una por PR**. No vamos a tocar código en esta tanda.

¿Apruebas el plan? ¿Quieres empezar por algún PR específico en la próxima sesión, o seguimos el orden A → H?

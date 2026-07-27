## Objetivo

Subir `tailwind-merge` de v2 a v3 (único major seguro pendiente tras Ola 1) y verificar que la app queda verde.

## Contexto

- `tailwind-merge` se usa exclusivamente en `src/lib/utils/cn.ts` vía `twMerge(clsx(...))`.
- v3 cambia el bundling (ESM-only, tree-shaking mejor) y ajusta algunas reglas de conflicto de clases, pero la API pública `twMerge()` con strings se mantiene compatible.
- Riesgo bajo: no hay configuración custom (`extendTailwindMerge`) ni imports de tipos internos.

## Pasos

1. **Actualizar dependencia**
   - `bun add tailwind-merge@^3` (regenera `bun.lock` en modo texto, ya configurado en Ola 1).

2. **Validaciones en cascada (fail-fast)**
   - `bun run lint -- --max-warnings 0`
   - `bunx tsgo --noEmit` (typecheck)
   - `bun run test:fast` (suite Vitest completa)
   - `bun run test:e2e` si el entorno lo permite; si requiere staging remoto, dejar constancia y correr al menos la suite de humo local (`e2e/specs/01-login` + `13-dashboard-responsive`).

3. **Rollback plan**
   - Si falla lint/typecheck/tests: `bun add tailwind-merge@2.6.0` y reportar la incompatibilidad concreta.
   - No se toca ningún componente en este PR; si v3 rompe clases en runtime, se revierte antes de mergear.

4. **Versionado y changelog**
   - Bump `APP_VERSION` → `13.320.28` en `src/constants/appVersion.ts`.
   - Entrada en `CHANGELOG.md`:
     ```
     ## [13.320.28] - 2026-07-27
     - **chore(deps)**: tailwind-merge 2 → 3 (Ola 2, único major de bajo riesgo restante).
     ```
   - Actualizar `mem://constraint/lovable-stack-pins` para reflejar que `tailwind-merge` ya no está en 2.

## Criterio de éxito

- `lint`, `typecheck` y `test:fast` en verde.
- E2E de humo sin regresiones visuales en Dashboard/Sidebar (donde `cn()` más se ejerce).
- Sin cambios en componentes; único diff funcional es `package.json` + `bun.lock`.

## Detalles técnicos

- v3 requiere Node ≥ 18 (ya cumplido en CI).
- `clsx` sigue en su versión actual; no se toca.
- Si aparece warning de tipos por el nuevo `ClassNameValue` genérico, se ajusta la firma de `cn()` en `src/lib/utils/cn.ts` (una línea) sin romper llamadas existentes.

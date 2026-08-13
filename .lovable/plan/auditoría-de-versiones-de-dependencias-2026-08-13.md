# Auditoría de versiones de dependencias

Sin vulnerabilidades altas ni críticas hoy (npm audit limpio). La actualización es de mantenimiento, no de emergencia.

## Ola A — Seguras (parches, sin riesgo)
Actualizar a la última versión de parche:

`@playwright/test`, `@react-pdf/types`, `@tanstack/react-virtual`, `eslint`, `libphonenumber-js`, `nuqs`, `postcss`, `sonner`, `tsx`

Riesgo: mínimo. Validación: `lint` + `test` + `build`.

## Ola B — Menores (compatibles, revisar tras aplicar)
`@react-pdf/renderer` 4.5→4.6, `@sentry/react` 10.68→10.70, `@supabase/supabase-js` 2.110→2.112, `@types/node` 26.1→26.2, `globals` 17.8→17.11, `knip` 6.29→6.32, `lucide-react` 1.27→1.31, `react-hook-form` 7.83→7.85, `terser` 5.49→5.50, `typescript-eslint` 8.65→8.67

Puntos de atención:
- `@react-pdf/renderer`: correr las pruebas de PDF (canary de 200 renders y contrato multi-página).
- `knip` y `typescript-eslint`: pueden reportar hallazgos nuevos en CI; se resuelven en el mismo cambio.
- `react-hook-form`: validar wizards de cotización/embarque.

## Ola C — Mayores permitidos (uno por vez, cada uno con su verificación)
1. `@hookform/resolvers` 3.10 → 5.x — cambia la firma del resolver de Zod (ya usamos Zod 4, lo cual favorece la subida).
2. `@testing-library/jest-dom` 6 → 7 — solo pruebas.
3. `jsdom` 29 → 30 — entorno de pruebas.
4. `vitest` + `@vitest/coverage-v8` 3.2.4 → 4.x — cambios en configuración/reporteo de cobertura y en `--merge-reports`; afecta los shards y umbrales de CI. Es el más costoso; hacerlo aislado.
5. `date-fns` 3.6 → 4.x — nuevo manejo de zonas horarias; revisar utilidades UTC de fechas.
6. `@tanstack/react-table` 8 → 9 — afecta todas las tablas (`DataTable`); alto impacto visual.
7. `recharts` 2.15 → 3.x — gráficas de dashboard y cartera.
8. `zod-validation-error` 4 → 5 — hay `overrides`/`resolutions` que también deben moverse.
9. `eslint-plugin-react-refresh` 0.5.3 → 0.5.4.

## No actualizar (bloqueados por la plataforma Lovable)
`vite` (5), `tailwindcss` (3), `typescript` (5), `react-router-dom` (6), `@vitejs/plugin-react-swc` (3), `tailwind-merge` (ya en 3 por decisión previa; no subir más allá de lo permitido).

Subirlos rompe el build de Lovable, así que quedan fuera del alcance.

## Recomendación de ejecución
Sugiero aplicar **Ola A + Ola B en un solo cambio** (bajo riesgo, beneficio inmediato) y dejar la Ola C como cambios separados, elegidos por prioridad. Cada ola cierra con `lint`, `typecheck`, `test` y `build`, más entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Detalles técnicos
- Comando por paquete: `bun add <pkg>@<version>` (no `ncu -u` masivo, para poder atribuir fallos).
- Tras subir `zod-validation-error` hay que sincronizar los bloques `overrides` y `resolutions` de `package.json`.
- Tras `vitest` 4 revisar `vitest.config.ts`, `vitest.perf.config.ts` y los scripts de shard/merge de cobertura.

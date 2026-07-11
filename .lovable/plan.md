OBJETIVO
Actualizar las dependencias que tienen versiones seguras de parche/menor y evaluar, uno por uno, los cambios de versión mayor que no están bloqueados por las reglas del stack de Lovable.

ANÁLOGO
La app es como un carro: los cambios de parche/menor son mantenimiento (aceite y filtros); los cambios de versión mayor son cambios de motor; y algunos motores están sellados por el taller Lovable, así que no los tocamos.

HALLAZGOS
- 0 vulnerabilidades altas/críticas.
- 0 dependencias sin usar (knip).
- 37 dependencias con actualizaciones de parche/menor seguras.
- 7 majors no bloqueados que requieren revisión manual.
- 10 majors bloqueadas por la memoria del stack de Lovable.

LOTE A - ACTUALIZACIONES SEGURAS (parche/menor)
Aplicar con `bun update`. Se mantienen en la misma versión mayor, así que el riesgo de romper funcionalidad es bajo.

| Grupo | Paquetes | De | A |
|---|---|---|---|
| Radix UI (17 componentes) | accordion, alert-dialog, avatar, checkbox, collapsible, dialog, dropdown-menu, label, popover, progress, radio-group, select, separator, switch, tabs, toggle-group, tooltip | 1.1.x / 1.2.x / 1.3.x / 2.1.x | último parche/menor |
| Sentry | @sentry/react | 10.62.0 | 10.65.0 |
| Sentry | @sentry/vite-plugin (dev) | 5.3.0 | 5.4.0 |
| Tanstack | @tanstack/react-query | 5.101.1 | 5.101.2 |
| Tanstack | @tanstack/react-query-persist-client | 5.101.1 | 5.101.2 |
| Tanstack | @tanstack/query-sync-storage-persister | 5.101.1 | 5.101.2 |
| Tanstack | @tanstack/react-virtual | 3.14.4 | 3.14.5 |
| Supabase | @supabase/supabase-js | 2.108.2 | 2.110.2 |
| Formularios | react-hook-form | 7.80.0 | 7.81.0 |
| Utilidades | nuqs | 2.8.9 | 2.9.0 |
| Utilidades | libphonenumber-js | 1.13.7 | 1.13.8 |
| Utilidades | terser | 5.48.0 | 5.49.0 |
| Dev tooling | @types/node | 26.0.1 | 26.1.1 |
| Dev tooling | @vitest/coverage-v8 | 4.1.9 | 4.1.10 |
| Dev tooling | eslint | 10.6.0 | 10.7.0 |
| Dev tooling | knip | 6.22.0 | 6.26.0 |
| Dev tooling | lovable-tagger | 1.3.0 | 1.3.1 |
| Dev tooling | postcss | 8.5.15 | 8.5.16 |
| Dev tooling | tsx | 4.22.4 | 4.23.0 |
| Dev tooling | typescript-eslint | 8.62.0 | 8.63.0 |
| Dev tooling | vitest | 4.1.9 | 4.1.10 |

Pasos para Lote A:
1. `bun update` (actualiza lockfile y package.json dentro de los rangos actuales).
2. `bun install`.
3. `bun run lint -- --max-warnings 0`.
4. `bun run typecheck`.
5. `bun run test:fast` (excluye canarios y tests de performance).
6. `bun run build`.
7. Si todo pasa, bumpear `APP_VERSION` y agregar entrada a `CHANGELOG.md`.

LOTE B - MAJORS NO BLOQUEADOS (riesgo medio/alto)
Se actualizarán de forma individual, revisando changelog y migrando APIs rotas.

| Paquete | Actual | Disponible | Riesgo | Notas |
|---|---|---|---|---|
| @hookform/resolvers | 3.10.0 | 5.4.0 | Medio | Validación de formularios; revisar compatibilidad con react-hook-form y zod |
| date-fns | 3.6.0 | 4.4.0 | Medio | Fechas en toda la app; revisar imports y locales |
| lucide-react | 0.462.0 | 1.24.0 | Medio | Iconos; posibles cambios de nombres |
| react-day-picker | 8.10.2 | 10.0.1 | Alto | Calendarios; API cambia significativamente |
| sonner | 1.7.4 | 2.0.7 | Medio | Toasts; revisar props |
| zod | 3.25.76 | 4.4.3 | Alto | Validaciones en todo el proyecto |
| recharts | 2.15.4 | 3.9.2 | Medio | Gráficos del dashboard |

Pasos para Lote B (uno por paquete):
1. Revisar changelog y guía de migración oficial.
2. Actualizar la versión en package.json.
3. Corregir imports y APIs rotos en el código.
4. Agregar o ajustar tests si cambian contratos.
5. `bun run lint`, `bun run typecheck`, `bun run test:fast`, `bun run build`.
6. Bumpear `APP_VERSION` y agregar entrada a `CHANGELOG.md` por cada paquete migrado.

LOTE C - NO TOCAR (bloqueadas por reglas del proyecto)
| Paquete | Actual | Disponible | Regla |
|---|---|---|---|
| react | 18.3.1 | 19.2.7 | Stack Lovable fijado |
| react-dom | 18.3.1 | 19.2.7 | Stack Lovable fijado |
| react-router-dom | 6.30.4 | 7.18.1 | Router 7 prohibido |
| vite | 5.4.21 | 8.1.4 | Vite 8 prohibido |
| tailwindcss | 3.4.19 | 4.3.2 | Tailwind 4 prohibido |
| typescript | 5.9.3 | 7.0.2 | TS 6/7 prohibido |
| @vitejs/plugin-react-swc | 3.11.0 | 4.3.1 | SWC plugin 4 prohibido |
| tailwind-merge | 2.6.1 | 3.6.0 | Tailwind-merge 3 prohibido |
| @types/react | 18.3.31 | 19.2.17 | Tipos React 19 prohibidos |
| @types/react-dom | 18.3.7 | 19.2.3 | Tipos React 19 prohibidos |

RIESGOS Y MITIGACIONES
- Regresiones visuales: Radix/Sonner pueden cambiar estilos internos. Mitigar con tests de UI y revisión visual en preview.
- Validaciones rotas: Zod y react-hook-form/resolvers son críticos. Mitigar con tests de formularios.
- Build roto: ESLint/Vitest/Tailwind deben pasar antes de mergear.
- Pinned majors: nunca se tocan sin aprobación explícita de migración de stack.

CRITERIOS DE ÉXITO
- Lote A: lint 0 warnings, typecheck 0 errores, test:fast pasa, build pasa.
- Lote B: cada paquete migrado con tests actualizados y 0 regresiones.
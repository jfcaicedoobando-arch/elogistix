# Adoptar "The Power of 10" en Libre Carga

Incorporar las 10 reglas como estándar formal del proyecto, ajustando las que necesitan matiz para no chocar con casos legítimos del dominio (paginación interna, wizards densos, warnings residuales). Aplicable a **código nuevo y refactors**; el legacy se atiende por dominio según baseline.

## Reglas finales (adaptadas)

Versión definitiva que se documentará y se hará cumplir:

1. **Flujo de control simple** — Early returns para `loading`/`error`. Prohibido ternario anidado >1 nivel en JSX.
2. **Límites de paginación en UI** — Toda query que alimente una **lista visible** debe paginar (`.range()` server-side o `.limit()` explícito). Queries agregadas, exports y RPCs reportan internamente con paginación explícita; no aplica `.limit(20)` ciego.
3. **Cleanup obligatorio** — Todo `useEffect` con `subscribe`, `setInterval`, `setTimeout`, `addEventListener` o canal Supabase Realtime retorna cleanup (`removeChannel`, `clearInterval`, etc.). Ya es regla core.
4. **Componentes ≤200 líneas** — Si crece, extraer a `use<X>Controller` (lógica) y subcomponentes (UI). Wizards/diálogos densos pueden llegar a 250 con justificación en comentario de cabecera.
5. **Programación defensiva** — Tipos generados de Supabase, validación de existencia (`if (!data) return …`), Error Boundaries por ruta principal. Prohibido `any` salvo override documentado.
6. **Estado local primero** — `useState` por defecto; elevar a Context/store sólo si dos hermanos lo comparten realmente. Ya es regla core.
7. **Manejar errores de red** — Toda llamada Supabase verifica `error` y notifica vía `useToast` + `errorCatalog`.
8. **Stack estándar** — Vite + Tailwind + shadcn sin macros ni scripts inyectados. Sin postprocesadores ad-hoc.
9. **Prop-drilling controlado** — A partir de **3 niveles** revisar composición o usar Context. No es prohibición dura, es señal de refactor.
10. **Compilación limpia** — Cero warnings de TS/ESLint en build. Cero `any`. Warnings residuales (chunk size, devtools) se resuelven antes de activar el bar.

## Plan de implementación (4 fases)

### Fase 1 — Documentación (sin código de app)
- Agregar **§20 The Power of 10** en `ARCHITECTURE.md` con las 10 reglas adaptadas y ejemplos ✅/❌ por regla.
- Crear `mem://principles/power-of-10` con la versión condensada y registrarlo en `mem://index.md` (Core: una línea “Aplicar Power of 10 — ver mem://principles/power-of-10”).
- Bump `APP_VERSION` + entrada en changelog.

### Fase 2 — Baseline de auditoría (read-only, sin cambios funcionales)
- Script `scripts/audit-power10.ts` (Node, ejecutable con `bunx tsx`) que reporta:
  - Componentes >200 líneas (regla #4).
  - Archivos con `any` explícito (regla #5/#10).
  - `useEffect` con `.subscribe(`/`setInterval(`/`addEventListener(` sin retorno (heurística AST simple, regla #3).
  - Queries Supabase `.from(...).select(...)` sin `.range`/`.limit` en hooks de listado (regla #2).
- El script genera `docs/power10-baseline.md` con conteos por dominio para priorizar limpieza por sprint.
- No modifica código de app.

### Fase 3 — Endurecimiento de ESLint
- Activar/elevar a `error`:
  - `@typescript-eslint/no-explicit-any`
  - `react-hooks/exhaustive-deps`
  - `react-hooks/rules-of-hooks`
  - `@typescript-eslint/no-unused-vars`
  - `max-lines-per-function` con límite 200 y override para `*.test.*`, `src/components/ui/**` (shadcn vendored), `supabase/migrations/**`.
- Custom rule mínima (o regex via `eslint-plugin-no-restricted-syntax`) para detectar `useEffect` que llama `.subscribe(`/`setInterval(`/`addEventListener(` sin `return`.
- Primera pasada usa `// eslint-disable-next-line` con TODO en violaciones legacy listadas por la baseline; PRs nuevos no pueden agregar.

### Fase 4 — Limpieza por dominio (iterativa, opcional)
Recorrer la baseline en orden de criticidad (auditoría → embarque → cotización → cliente → resto), un PR por dominio, sin mezclar con features. Cada PR:
- Elimina los `eslint-disable` introducidos en Fase 3 para ese dominio.
- Refactoriza componentes >200 líneas extrayendo controllers/subcomponentes.
- Reemplaza `any` por tipos generados o `unknown` + narrowing.
- Agrega cleanup faltante en `useEffect`.

## Detalles técnicos

- **No tocar `src/components/ui/**`** (shadcn read-only) ni `src/integrations/supabase/{client,types}.ts`.
- ESLint ya está configurado en el proyecto; sólo se editan `eslint.config.js` y se documenta el override en `ARCHITECTURE.md`.
- El script de baseline corre en CI opcionalmente como reporte (no falla el build inicialmente).
- Las reglas se aplican primero como guía para la **IA generadora** (memoria + ARCHITECTURE) y luego como gate técnico (ESLint), para evitar bloquear desarrollo mientras se limpia legacy.

## Entregables por fase

| Fase | Entregables | Riesgo |
|------|------------|--------|
| 1 | `ARCHITECTURE.md §20`, `mem://principles/power-of-10`, changelog | Nulo |
| 2 | `scripts/audit-power10.ts`, `docs/power10-baseline.md` | Nulo (read-only) |
| 3 | `eslint.config.js` endurecido + disables temporales en legacy | Bajo (no rompe runtime) |
| 4 | Refactors por dominio, eliminación de disables | Medio (cambios reales) |

## Fuera de alcance

- Migrar shadcn vendored (queda exento de #4).
- Reescribir wizards/diálogos densos que cumplen su rol (sólo se tocan si la baseline los marca y aporta).
- Cambiar la stack (Vite/Tailwind/React Query) — la regla #8 la fija como permanente.

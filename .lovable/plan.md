# Plan: 5 auditorías de calidad post-arquitectura

Continuación de la auditoría arquitectónica (v11.31.0–11.32.0). Cada etapa es un loop independiente, ejecutable por separado y verificable con tests + lint.

## Hallazgos preliminares (validación rápida)

- `services/`: **0 imports** a `@/hooks`, `@/components`, `@/pages` → capa ya limpia.
- `components/` >200 líneas: solo `ui/sidebar.tsx` (637, código upstream de shadcn) y archivos de test. **Componentes propios ya cumplen Power of 10.**
- `as unknown as` restantes: **37 totales**, mayoría en tests (`_supabaseChainMock`, fixtures). Solo ~5 en código de producción.
- Hooks/lib sin test directo: ~193 archivos (incluye barrels, índices y helpers triviales — el número real de "críticos sin test" es menor).

Esto reordena las prioridades. El plan refleja el peso real, no el percibido inicialmente.

---

## Etapa 1 — Auditoría de `services/` (🟢 baja, validación)

**Objetivo:** confirmar que la capa de servicios mantiene separación estricta (solo Supabase + utils, sin lógica de negocio compleja ni dependencias a capas superiores).

- Verificar que ningún `services/*` importa de `@/hooks`, `@/components`, `@/pages`, `@/contexts`.
- Añadir bloque ESLint `no-restricted-imports` para `src/services/**` (espejo del que ya existe en `lib/`).
- Extender `src/lib/__tests__/architecture.test.ts` para cubrir también `src/services/**`.
- Buscar servicios >200 líneas → si los hay, dividir por responsabilidad (queries / mutations / mappers).

**Entregable:** ESLint rule + test ampliado. Sin cambios de código si la capa ya está limpia.

---

## Etapa 2 — Auditoría de `components/` (🟢 baja, validación)

**Objetivo:** confirmar que componentes propios cumplen Power of 10 y no tienen lógica de negocio mal ubicada.

- Excluir `components/ui/*` (shadcn upstream) del análisis.
- Buscar componentes con `useQuery`/`useMutation` directos (debería ir vía hook controller).
- Buscar componentes con cálculos financieros, parseo o lógica de dominio inline → mover a `lib/`.
- Verificar que la regla `max-lines: 250` ya cubre el resto.

**Entregable:** lista de violaciones reales + refactor solo de las críticas. Probablemente loop corto.

---

## Etapa 3 — Reducir `as unknown as` (🟡 media)

**Objetivo:** bajar de 37 a <10 ocurrencias, todas justificadas.

- **Producción (~5):** caso por caso. Candidatos: `lib/supabase/cast.ts` (intencional, encapsula la conversión), `services/embarque/queries/*`, `services/facturas/*`, `pages/dev/PdfPreviewCotizacion.tsx`.
- **Tests (~32):** la mayoría vienen de `_supabaseChainMock.ts`. Crear helper tipado `mockSupabaseChain<T>()` que elimine el cast en cada test.
- Documentar las restantes con comentario `// SAFE-CAST:` explicando por qué no se puede tipar mejor.
- Añadir ESLint rule custom o regex en CI que advierta si aparecen nuevos sin el comentario.

**Entregable:** count <10 + helper de mocking + convención `SAFE-CAST`.

---

## Etapa 4 — Cobertura de tests (🟠 alta, mayor esfuerzo)

**Objetivo:** subir cobertura de los módulos críticos sin tests.

- Generar reporte de cobertura real con `vitest run --coverage` (no solo "tiene archivo .test.ts").
- Identificar los **20 archivos más críticos** sin cobertura: probablemente en `lib/financial/`, `lib/domain/`, `services/cotizacion/`, `services/embarque/`.
- Escribir tests para cada uno priorizando: cálculos financieros (IVA, tipo cambio), validación (`embarqueWizardSchemas`), mappers de Supabase.
- Meta: pasar de 622 → ~720 tests, con cobertura >80% en `lib/` y `services/`.

**Entregable:** +100 tests aproximados, reporte de cobertura adjunto al CHANGELOG. **Este es el loop más largo — probablemente 2 sub-loops.**

---

## Etapa 5 — Performance audit (🟠 alta, requiere medición)

**Objetivo:** identificar costos reales antes de optimizar (no premature optimization).

- **Bundle size:** correr `vite build` con `--mode=analyze`, identificar los 5 chunks más pesados. Candidatos a lazy-load: `@react-pdf/renderer` (PDFs), `recharts` (dashboard), módulos de auditoría.
- **Queries N+1:** auditar `services/embarque/` y `services/cliente/` por queries en bucle. Convertir a `.in()` o joins de Supabase.
- **React Query GC time:** revisar si hay queries con `staleTime: Infinity` que deberían refrescar.
- **DataTable:** ya tiene tests de performance (mount 10k <90ms). Validar que se usa `VirtualDataTable` en listas >100 filas.
- **Lighthouse audit** del dashboard principal y portal cliente.

**Entregable:** reporte `docs/performance-audit.md` con top 5 mejoras priorizadas + lazy-loading de los chunks gordos.

---

## Orden de ejecución sugerido

1. **Etapa 1** (services audit) — quick win, refuerza guardrails ya establecidos.
2. **Etapa 2** (components audit) — quick win, valida Power of 10.
3. **Etapa 3** (casts) — mejora puntual de tipo-seguridad.
4. **Etapa 5** (performance) — alto impacto visible para el usuario final.
5. **Etapa 4** (cobertura) — el más largo, mejor al final con base ya estable.

Cada etapa = 1 release patch/minor (`11.33.x` → `11.37.x`), CHANGELOG individual, sin acumular cambios.

## Detalles técnicos

- **No tocar:** `components/ui/*` (shadcn), `integrations/supabase/types.ts` (auto-gen), `lib/supabase/cast.ts` (intencional).
- **Convención SAFE-CAST:** `// SAFE-CAST: razón concreta` justo encima del cast permitido.
- **Tests de arquitectura:** patrón replicable — copiar `lib/__tests__/architecture.test.ts` adaptando el path raíz.
- Cada etapa debe mantener: lint 0/0, typecheck 0/0, todos los tests verdes.

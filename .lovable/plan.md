# Plan: Expansión de cobertura de tests (Fase 2)

## Diagnóstico actual

- **1,094 archivos fuente** vs **161 tests** (~14.7% file-coverage). Vitest + v8 verde.
- **Buena cobertura**: `lib/financial` (4/5), `lib/parsers` (5/4), `lib/mappers` (9/8), `lib/domain` (19/13), `features/embarques/{domain,services}` (32/20).
- **Huecos críticos** (0 tests):
  - `src/services/`: 22 subcarpetas (auditoria, cxp, tesoreria, presupuesto, profit, comisiones, proveedor, catalogos, configuracion, csf, dashboard, notificaciones, operaciones, organization, planes, reportes, search, storage, tracking, usuario, bitacora, cliente-usuarios).
  - `src/hooks/`: 16 subcarpetas (admin 15 src, cliente 7, catalogos 7, proveedor 5, cxp 4, comisiones 4, operaciones 4, presupuesto 4, profit 2, tesoreria 2, dashboard 3, dashboard-ejecutivo 2, reportes 2, sentry 2, usuario 3, layout 2).
  - `src/features/embarques/hooks/`: 31 archivos top-level con 0 tests.
  - `src/contexts/`: 7 archivos con 0 tests (Auth, Organization, Theme, Breadcrumb, sub-hooks).
  - `src/pdf/`: 26 archivos con 0 tests (documents, components, theme).
  - `src/generators/`: 5 archivos sin tests (cotizacion/*, estadoCuentaPdf, layoutContable, rentabilidadPdf).

## Objetivo

Llegar a **~32% de file-coverage** (~350 tests) añadiendo **~130 archivos nuevos** en 7 lotes que se ejecutan en paralelo por subagentes independientes.

## Lotes paralelizables

| Lote | Dominio | Archivos a testear | Tests objetivo | Modelo |
|------|---------|--------------------|----------------|--------|
| **L1** | `src/services/` financiero | tesoreria (5), cxp (3), comisiones (4), presupuesto (4), profit (3) | ~19 | fast |
| **L2** | `src/services/` operativo+admin | auditoria (6), operaciones, tracking, dashboard, reportes, search, notificaciones, organization, planes, storage (2), usuario, cliente-usuarios, bitacora, csf, configuracion (2), catalogos, proveedor | ~25 | fast |
| **L3** | `src/features/embarques/hooks/` | 31 hooks top-level (queries, financials, wizards, controllers, proformas, tracking) | ~22 | capable |
| **L4** | `src/hooks/` admin+catálogos+cliente+proveedor | admin (15), cliente (7), catalogos (7), proveedor (5) | ~22 | fast |
| **L5** | `src/hooks/` operativo+financiero+misc | cxp (4), comisiones (4), operaciones (4), presupuesto (4), profit (2), tesoreria (2), dashboard (3), dashboard-ejecutivo (2), reportes (2), sentry (2), usuario (3), layout (2) | ~22 | fast |
| **L6** | `src/contexts/` + `src/generators/` restantes | AuthContext, OrganizationContext, ThemeContext, BreadcrumbContext, useAuthProfile/Session/LoginAudit, cotizacion/conceptosTables, cotizacion/datosGenerales, estadoCuentaPdf, layoutContable, rentabilidadPdf | ~12 | capable |
| **L7** | `src/pdf/` documents + helpers puros | proformaShared (ya), emisor, theme/tokens, theme/styles*, render/descargarPdf, documents/*Document (smoke render: no crash + estructura JSX) | ~14 | fast |

**Total estimado**: ~136 archivos nuevos de test.

## Convenciones obligatorias para todos los subagentes

1. **Patrón mocking**: usar `vi.hoisted(() => vi.fn())` para mocks de Supabase. Reutilizar `src/test/utils/_supabaseChainMock.ts` cuando exista cadena `.from().select()....`
2. **Hooks con React Query**: envolver con `createWrapper()` de `src/test/utils/queryWrapper.tsx`.
3. **Hooks con `useAuth`**: mockear `@/contexts/AuthContext` con `useAuth: () => ({ user: { id: "user-1" } })`.
4. **Archivos prohibidos de tocar**: `src/integrations/supabase/{client,types}.ts`, `.env`, `supabase/config.toml`, `vitest.config.ts` (no subir thresholds).
5. **Naming**: `__tests__/<archivo>.test.ts(x)` co-ubicado.
6. **Reglas Power of 10**: cada test ≤200 líneas, sin `any`, sin `style={{...}}` estático.
7. **Cobertura mínima por archivo**: 1 happy path + 1 error/edge path (mínimo 2 `it()` por `describe`).
8. **PDF tests (L7)**: solo smoke (`expect(() => render(<Doc {...props}/>)).not.toThrow()`); NO comparar PNG. Para tokens/theme: validar shape de objetos.
9. **Contextos (L6)**: probar provider + hook consumidor + caso "sin provider lanza error".
10. **No regresiones**: NO refactorizar código de producción. Si un archivo requiere refactor >30 líneas para ser testeable, reportar como "skipped" con razón.

## Orquestación

```text
┌──────────────────────────────────────────────────────────┐
│  Agente maestro (yo)                                     │
└────────┬─────────────────────────────────────────────────┘
         │ spawn paralelo
         ▼
   ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
   │ L1  │ L2  │ L3  │ L4  │ L5  │ L6  │ L7  │
   └──┬──┴──┬──┴──┬──┴──┬──┴──┬──┴──┬──┴──┬──┘
      └─────┴─────┴─────┴─────┴─────┴─────┘
                       │ resultados (lista de archivos + nº tests)
                       ▼
        Consolidación: bump APP_VERSION → 12.56.0
        + entrada única en CHANGELOG.md
        + verificación: `bun run test` (smoke) + `bun run audit:tests`
```

## Detalles técnicos por lote

- **L1/L2 (services)**: tests de I/O. Verifican que `supabase.from(X).select(...).eq(...).range(...)` se llama con los argumentos esperados y que errores se propagan (`throw error`).
- **L3 (embarques/hooks)**: tests de hooks con `renderHook`. Mockear servicios de `@/features/embarques/services` y verificar invalidaciones de `queryKey`.
- **L4/L5 (hooks)**: mismo patrón que L3 pero sobre `src/services/<dominio>`. Para `useListPageState`-style, mockear `nuqs`.
- **L6 (contexts)**: mockear `supabase.auth.onAuthStateChange` y `getSession`. Validar cleanup de subscription. Para generators no-PDF: tests funcionales puros sobre arrays/strings producidos.
- **L7 (pdf)**: usar `@react-pdf/renderer` mock ligero o `renderToString`. Solo verificar que con props mínimos válidos no lanza. Tokens/styles: validar keys obligatorias.

## Fuera de alcance

- E2E Playwright (carpeta `e2e/`).
- Tests visuales/snapshot de PDFs (solo smoke).
- Tests Deno de `supabase/functions/` (ya existen `_test.ts`).
- Tests de páginas en `src/pages/` (UI compleja, ROI bajo vs hooks).
- Subir thresholds en `vitest.config.ts` (lo haremos en una iteración posterior cuando midamos coverage real con `vitest run --coverage`).

## Entregables

1. ~136 archivos `*.test.ts(x)` nuevos.
2. Bump `APP_VERSION` → `12.56.0`.
3. Entrada `## [12.56.0] - 2026-06-04` en `CHANGELOG.md` con desglose por lote y total de tests añadidos.
4. Reporte de archivos "skipped" (si los hay) con razón.

Al aprobar este plan, lanzo los 7 subagentes en paralelo y consolido la versión cuando todos reporten.

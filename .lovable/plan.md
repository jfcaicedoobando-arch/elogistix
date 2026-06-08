# Auditoría de Tests — Plan

## Objetivo
Auditar los **308 archivos de test** del proyecto (unit, integration, edge functions y E2E) en busca de problemas reales de calidad, no de estilo. Entregar un reporte preciso, accionable y priorizado en `docs/audit-tests-2026-06-08.md`.

## Inventario
| Área | Archivos |
|---|---|
| `src/services/**` | 68 |
| `src/features/**` | 62 |
| `src/hooks/**` | 61 |
| `src/lib/**` | 59 |
| `src/pdf/**` | 18 |
| `src/components/**` | 11 |
| `supabase/functions/**` (Deno) | 9 |
| `src/contexts/**` | 7 |
| `src/generators/**` | 6 |
| `e2e/specs/**` (Playwright) | 5 |
| `src/__tests__/**` | 2 |
| **Total** | **308** |

## Reglas de auditoría (qué busca cada subagente)
Cada hallazgo debe citar `archivo:línea` y clasificarse por severidad (`CRITICAL` / `HIGH` / `MEDIUM` / `LOW`).

1. **Falsos positivos** — tests que pasan sin probar nada útil: aserciones tautológicas (`expect(true).toBe(true)`), `expect(mockFn).toBeDefined()`, snapshots vacíos, ausencia total de `expect`.
2. **Tests acoplados a la implementación** — assertions sobre internals que rompen al refactorizar (orden de llamadas a mocks sin razón, conteos exactos de re-renders, strings de error literales).
3. **Mocks incorrectos** — mock del SUT, mocks que no respetan la cadena thenable de Supabase (ver `mem://technical/testing-mock-patterns`), mocks sin reset entre `it()`, `vi.fn()` sin verificar llamadas.
4. **Cobertura de happy-path únicamente** — falta de casos de error, edge cases (null/undefined/array vacío), branches no cubiertas, RLS / multi-tenant no validado en services.
5. **`skip`/`only`/`todo` sin issue asociado** — ya cubierto por `scripts/audit-tests.ts`; verificar que no haya regresiones y reportar los que existan hoy.
6. **Títulos duplicados entre archivos** — mismo `it("…")` en >1 archivo sin razón clara (DUPLICATE_ALLOWLIST).
7. **Higiene React / async** — falta `waitFor`, queries no-accesibles (`getByTestId` en lugar de `getByRole`), ausencia de `cleanup` cuando el test crea suscripciones/timers (ver `mem://technical/testing-cleanup-protocol`), `act()` warnings ignorados.
8. **Tests lentos o frágiles** — `setTimeout` reales en lugar de `vi.useFakeTimers()`, llamadas de red reales, dependencia del orden de ejecución entre `it()`.
9. **Tests muertos** — archivos cuyo SUT ya no existe o cambió de firma, imports rotos comentados.
10. **Edge Functions (Deno)** — uso correcto de `Deno.test`, mocks de `fetch`, validación de inputs y respuestas CORS.
11. **E2E (Playwright)** — selectores frágiles, `waitForTimeout` arbitrarios, ausencia de fixtures aisladas.
12. **PDF / Leak Canary** — verificar que la red de seguridad de `mem://features/testing-regression-canary` siga activa.

## Distribución del trabajo (subagentes en paralelo)
Cada subagente recibe: lista de archivos asignados, reglas 1-12 arriba, formato de salida estricto y la instrucción de citar `archivo:línea`.

| Subagente | Alcance | Archivos |
|---|---|---|
| **A1** | `src/services/**` parte 1 (cotizacion, embarques, clientes, facturacion, cxp) | ~34 |
| **A2** | `src/services/**` parte 2 (resto: profit, presupuesto, tesoreria, comisiones, organization, auditoria, etc.) | ~34 |
| **A3** | `src/features/**` | 62 |
| **A4** | `src/hooks/**` + `src/contexts/**` | 68 |
| **A5** | `src/lib/**` | 59 |
| **A6** | `src/pdf/**` + `src/generators/**` + `src/components/**` + `src/__tests__/**` | 37 |
| **A7** | `supabase/functions/**` (Deno) + `e2e/specs/**` (Playwright) | 14 |

Todos se lanzan a la vez con `acp_subagent--spawn_agent` (modelo `capable` por la profundidad analítica). Mientras corren, yo en paralelo ejecuto:
- `bun run audit:tests` para capturar violaciones de higiene actuales.
- `rg` para detectar patrones globales: `expect(true)`, `toBeDefined\(\)\s*$`, `\.skip\(`, `\.only\(`, `waitForTimeout\(`, etc.
- Conteo de `expect()` por archivo para detectar tests sin aserciones reales.

## Consolidación
Cuando lleguen los 7 reportes:
1. Deduplicar hallazgos solapados.
2. Agrupar por severidad y por área.
3. Generar `docs/audit-tests-2026-06-08.md` con:
   - Resumen ejecutivo (totales por severidad).
   - Top 20 hallazgos `CRITICAL` / `HIGH` con cita exacta.
   - Tabla completa por área.
   - Recomendaciones de remediación priorizadas.
   - Lista de tests candidatos a eliminar (muertos / tautológicos).
4. Actualizar `CHANGELOG.md` y `APP_VERSION` (bump patch) según `mem://instructions/changelog-updates`.

## Lo que NO incluye este plan
- **No** se modifican tests ni código de producción — es solo auditoría/reporte.
- **No** se ejecuta la suite completa de tests (eso es trabajo del CI).
- Si quieres remediar después, hacemos un plan separado priorizando los `CRITICAL`/`HIGH`.

## Entregable
Un único archivo: `docs/audit-tests-2026-06-08.md`, más el bump de versión y entrada en el changelog.

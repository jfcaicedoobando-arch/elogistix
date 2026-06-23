# Plan — Auditoría de **calidad** de tests (no de cobertura)

## Contexto

509 tests frontend + 29 tests Deno (edge). Distribución cargada hacia embarques (85), cotización (44), CRM (37), facturación (30). El número es sano pero la **calidad** es lo que decide si los tests funcionan como red de seguridad o como ruido que se ignora.

## Objetivo

Identificar tests que:
- **No prueban lógica de negocio** (sólo asertan mocks o tautologías como `expect(true).toBe(true)`)
- **No fallarían si la app se rompe** (sobre-mockeados — el mock devuelve lo que el test espera)
- **Frágiles** (acoplados a strings exactos de UI, orden de queries, IDs internos)
- **Duplicados o redundantes** (mismo escenario probado en 3 capas)
- **Cubren happy path pero NO casos críticos** (errores, edge cases financieros, race conditions)
- **Sin assertion de invariantes** (suma de IVA, redondeo MXN/USD, transiciones de estado prohibidas)

NO se mide cobertura de líneas. NO se proponen tests nuevos masivos. La auditoría es **diagnóstica**.

## Metodología — 3 sub-agentes en paralelo

### Sub-agente 1 — Tests de lógica de negocio crítica
Foco: `src/features/{embarques,cotizacion,facturacion,costeo,cxp,tesoreria,profit,comisiones}/`

Busca:
- Tests que mockean Supabase y luego asertan exactamente lo que el mock devolvió → no prueban nada
- Tests sin assertion de invariantes financieros (totales, IVA, conversión de divisas, redondeo)
- Tests que no cubren: transiciones de estado inválidas, candados (locks), permisos por rol, RLS
- Tests donde un cambio breaking en la lógica no haría fallar el test (lo cazaríamos pasando un Error como mock y viendo si el test sigue verde)

### Sub-agente 2 — Tests de hooks / componentes / servicios genéricos
Foco: `src/features/*/hooks/__tests__/`, `src/components/`, `src/lib/`

Busca:
- Tests de hooks que sólo verifican `render` sin interacción (low signal)
- Tests con assertions de DOM frágiles (`getByText('exactamente esto')` cuando el copy cambia seguido)
- Tests con timers/setTimeout/setInterval sin `vi.useFakeTimers` (flaky por diseño)
- Tests que mockean tantas cosas que el SUT real no se ejecuta
- `expect(spy).toHaveBeenCalled()` sin verificar argumentos → permite que el SUT llame mal
- Mocks de Supabase sin la cadena thenable correcta (ver `mem://technical/testing-mock-patterns`)

### Sub-agente 3 — Edge functions + guardrails de arquitectura
Foco: `supabase/functions/*/index_test.ts`, `src/__tests__/architecture/`

Busca:
- Edge function tests que sólo verifican CORS preflight (poca señal de negocio)
- Tests de arquitectura (Power of 10, sentry-edge-*) que se pueden burlar con comentarios o paths alternos
- Falta de tests para invariantes críticos: `wrapEdgeHandler` en funciones nuevas, scrub PII en `extra`, RLS en RPCs públicas
- Tests Deno que no consumen response body (memory leak — ver useful-context)

## Formato del reporte (lo que el usuario recibe)

Cada sub-agente devuelve una tabla:

| # | Severidad | Archivo:línea | Anti-patrón | Por qué no avisa cuando algo se rompe | Acción sugerida |

Y al cierre, una sección **"Patrones sistémicos detectados"** con los 3-5 problemas que se repiten en muchos tests (ataque de raíz vs caso por caso).

Severidades:
- 🔴 **CRÍTICO** — el test pasa aunque el código esté roto
- 🟠 **MEDIO** — el test rompe por razones equivocadas (frágil), o no cubre el caso que más duele
- 🟡 **BAJO** — redundante, lento, o de bajo valor pero no peligroso

## Excluido del scope (lo digo explícito)

- ❌ Cobertura de líneas/branches
- ❌ Tests nuevos (sólo se proponen si cierran un hueco crítico)
- ❌ Refactor de la infra de testing (mocks compartidos, setup) — eso ya tiene memorias propias (`testing-cleanup-protocol`, `testing-mock-patterns`)
- ❌ PDF leak canary y similares ya auditados — no se re-auditan

## Entregable final

Un único informe consolidado con:
1. **Top 10 tests más peligrosos** (los que dan falsa seguridad — pasan siempre)
2. **Patrones sistémicos** (qué arreglar de raíz)
3. **Top 5 huecos críticos sin test** (lógica de negocio importante que rompería en silencio)
4. **Lista verde** — qué dominios tienen tests sólidos (para usar de modelo)

NO se ejecuta nada — sólo lectura. Al aprobar, se lanzan los 3 sub-agentes en paralelo.

¿Apruebas?

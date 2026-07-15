# Auditoría Batch B + Fase 4 (D–F)

## Hallazgos de la auditoría del Batch B

**Bug 1 — Sincronización URL ↔ estado.** `usePeriodoMesUrl` y `TabVsReal` leen `searchParams` sólo en la inicialización (`useState`). Si el usuario usa botón **Atrás/Adelante** del navegador o comparte un link y navega dentro de la app, la URL cambia pero el estado interno no reacciona → se ve mes distinto al de la URL.

**Bug 2 — URL no se canonicaliza.** Si alguien entra con `?mes=2020-01` (fuera del `MES_MINIMO` del Dashboard), el hook cae al mes actual pero deja la URL con el valor inválido. Refresh perpetúa la inconsistencia.

**Bug 3 — `setSearchParams` con dependencia inestable.** `setMesKey`/`setPeriodo` dependen de `searchParams` — cada cambio en query params recrea el callback. Debe usar la forma funcional `setSearchParams((prev) => …)` para ser estable y evitar cierres obsoletos.

**Bug 4 — Edge case lista vacía.** El `return` con spread condicional funciona pero es frágil de leer. Consolidar en un sólo objeto con `mesActual` seguro.

## Fase 3 · Fixes + tests de regresión

1. Refactor `usePeriodoMesUrl`:
   - `useEffect` que sincroniza `mesKey` cuando `searchParams.get(paramName)` cambia y es válido.
   - Cuando `qp` existe pero es inválido (o cae fuera de `minMes`), escribir la URL canónica al montar.
   - `setSearchParams((prev) => …)` funcional; quitar `searchParams` de deps.
   - Simplificar el `return` (siempre devuelve `mesActual` seguro).

2. Aplicar la misma corrección en `TabVsReal` (o migrarlo al hook `usePeriodoMesUrl` para no duplicar lógica). Elegimos migrarlo → menos código, un solo punto de verdad.

3. Tests nuevos en `usePeriodoMesUrl.test.tsx`:
   - Cambio externo de URL (simular navegación) → `mesActual` se actualiza.
   - URL inválida → se reescribe a la canónica en la primera render.
   - `setMesKey` no depende de mutaciones externas del query string.

4. Test de integración ligero para `TabVsReal`:
   - Renderiza con `?periodo_vs_real=2026-05` → `MonthPickerMx` recibe ese valor.
   - Al cambiar el picker, se llama `setSearchParams` con el nuevo valor.

## Fase 4 · Batch D–F (siguiente fase del audit de Profit)

Batch D–F es amplio. Propongo dividir así (D primero como parte de este turno, E–F como iteraciones posteriores para no explotar el diff):

### Batch D · Performance & robustez (este turno)
- **Invalidación cruzada:** hoy `useDashboardEjecutivo`, `usePresupuestoVsReal` y las proyecciones no se invalidan tras crear/editar factura o pago. Auditar mutaciones de `pagos_factura`, `facturas`, `presupuesto_mensual` y añadir `queryClient.invalidateQueries` sobre las keys de Profit.
- **`staleTime` diferenciado:** las queries pesadas de Profit hoy usan el default (5 min). Ajustar a 60 s para el Dashboard (más volátil) y 5 min para EERR/VsReal (ya calculados por RPC).
- **Memoización defensiva:** en `BandaKPIs` y `GraficoEERR12m` los props se recomputan en cada render. Aplicar `useMemo` a las derivaciones caras (formateo de series 12 m).

### Batch E · Drill-downs (turno posterior)
- KPIs del Dashboard clicables: `Cartera vencida` → tabla filtrada `/cxc?dias_gt=30`; `Utilidad operativa` → EERR del mes; `Efectivo` → Tesorería. Se abre un `Sheet` lateral con detalle o `navigate` al módulo correspondiente.

### Batch F · Forecast (turno posterior)
- Extender la Proyección de Facturación a 3–6 meses hacia adelante con base en pipeline (`cotizaciones` en estado ganado) + histórico móvil. Requiere una RPC nueva `forecast_facturacion(meses int)`.

## Detalles técnicos (referencia)

```text
usePeriodoMesUrl
├─ useSearchParams()                    // hook v6
├─ mesesDisponibles (memo)              // ventana ± meses filtrada por minMes
├─ useEffect: sync qp → mesKey           // NUEVO: back/forward
├─ useEffect: canonicalizar URL          // NUEVO: qp inválido
├─ setMesKey usa setSearchParams(prev)  // FIX dep inestable
└─ mesActual seguro (nunca undefined)
```

## Cambios de versión y changelog

- Bumps: `13.300.32` (Fase 3 + Batch D).
- CHANGELOG: 1 bloque `[13.300.32]` con `fix(profit)` para los 4 bugs, `perf(profit)` para invalidaciones y `staleTime`, `test(profit)` para nuevos casos.

## Riesgos

- La canonicalización de URL cambia el path visible al abrir un link "malo"; documentado en el CHANGELOG.
- Ajustar `staleTime` reduce lecturas pero puede mostrar valor stale al alternar tabs — 60 s es un compromiso razonable para el Dashboard.
- Batch E y F quedan fuera de este turno para mantener el diff auditable.

## Problema

Hoy una sola persona cubre los 4 roles financieros (`contador`, `tesorero`, `ejecutivo_cobranza`, `auxiliar_contable`). El dashboard actual en `/inicio` está pensado para operaciones (alertas de demora, próximos arribos, profit table) y no le sirve. Necesita **un único dashboard financiero** que concentre todo lo accionable de los 4 frentes en una sola vista.

Más adelante, cuando se contraten roles separados, partimos este dashboard único en 4 vistas especializadas (queda fuera de alcance hoy).

## Diseño del dashboard financiero unificado

Visible **sólo** cuando `effectiveRole` ∈ {contador, tesorero, ejecutivo_cobranza, auxiliar_contable}. Para los demás roles el dashboard operativo actual sigue intacto.

Estructura en **4 bloques verticales** ordenados por urgencia (lo más urgente arriba):

```text
┌─ Saludo personalizado ─────────────────────────────────────┐
│  Buenos días Isela 👋   Domingo 21 de junio de 2026        │
│  Resumen: $X vencido • $Y por pagar hoy • Z facturas       │
└────────────────────────────────────────────────────────────┘

┌─ Bloque 1 · Hoy ───────────────────────────────────────────┐
│  [Por timbrar 8] [Por pagar hoy $X] [Vencido $Y] [Capt. 18]│
│  4 KPI tiles grandes, click → página correspondiente       │
└────────────────────────────────────────────────────────────┘

┌─ Bloque 2 · Cobranza ──────────────────────────────────────┐
│  Aging buckets (0-15 / 16-30 / 31-60 / 61-90 / 90+)        │
│  Top 10 facturas vencidas (cliente, monto, días, últ. rec.)│
└────────────────────────────────────────────────────────────┘

┌─ Bloque 3 · Pagos & Caja ──────────────────────────────────┐
│  Saldo total en bancos  |  mini chart entradas vs salidas  │
│  Top 10 facturas proveedor "Por pagar" (vence, monto)      │
└────────────────────────────────────────────────────────────┘

┌─ Bloque 4 · Cierre administrativo ─────────────────────────┐
│  - Embarques pendientes admin (la tarjeta ya existente)    │
│  - Top conceptos de costo abiertos sin factura proveedor   │
│  - Hueco de facturación (si lo hay)                        │
└────────────────────────────────────────────────────────────┘
```

Las tarjetas son sólo lectura desde el dashboard, pero cada fila/KPI **enlaza** a la página de detalle (`/cartera`, `/cxp/por-pagar`, `/facturacion/por-emitir`, `/cxp/por-capturar`, `/tesoreria`, etc.) — el rol ya tiene acceso a todas esas rutas.

## Arquitectura

- `src/features/dashboard/routes/Dashboard.tsx`: switch al inicio. Si rol es financiero → renderiza `<FinanceDashboard />`. Si no → flujo actual sin tocar.
- Nuevos archivos bajo `src/features/dashboard/finance/`:
  - `FinanceDashboard.tsx` — contenedor con los 4 bloques.
  - `components/FinanceHeader.tsx` — saludo + resumen one-liner.
  - `components/HoyKpiRow.tsx` — fila de 4 KPI tiles.
  - `components/CobranzaBlock.tsx` — aging + top vencidas.
  - `components/PagosCajaBlock.tsx` — saldo + flujo + top por pagar.
  - `components/CierreAdminBlock.tsx` — reusa `EmbarquesPendientesAdminCard` + conceptos abiertos + hueco.
  - `hooks/useFinanceDashboard.ts` — agrega los hooks ya existentes (`useCobranza`, `useResumenTesoreria`, `useDashboardEjecutivoFacturacion`, `useEmbarquesPendientesAdmin`, `useConceptosCostoAbiertos`, `useHuecoFacturacion`).
- Reglas del proyecto: componentes ≤200 líneas, sin `any`, `select` explícito, React Query `staleTime` 5 min, sin `useEffect` innecesarios.

Pensado de origen para que cuando se dividan los roles, cada bloque se vuelva su propio dashboard (Cobranza → ejecutivo de cobranza, Pagos & Caja → tesorero, Cierre admin → contador, etc.).

## Implementación en una sola entrega

Una sola versión (bump a `13.90.0`, cambio mayor de UX) con entrada en `CHANGELOG.md` describiendo los 4 bloques. Sin tests E2E nuevos — los hooks subyacentes ya están testeados.

## Lo que NO se hace

- No se tocan rutas, sidebar, RLS, ni el dashboard operativo de los demás roles.
- No se crean RPCs nuevas — sólo composición de hooks existentes.
- No se eliminan accesos: todas las páginas siguen disponibles desde el sidebar.

## Confirmación antes de construir

¿Avanzo con este dashboard unificado (4 bloques: Hoy / Cobranza / Pagos & Caja / Cierre administrativo) y bump a `13.90.0`?

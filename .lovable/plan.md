## Objetivo
Reforzar `src/services/facturas/cobranza.ts` para garantizar que los saldos pendientes NUNCA se sumen entre monedas, exponiendo subtotales explícitos por divisa y usando los helpers de precisión de `financialUtils` (consistente con `mem://technical/financial-calculations-standards`).

## Diagnóstico
- `calcularKPIs` ya separa `total_mxn`/`total_usd` pero acumula con `+=` plano (drift de punto flotante en cartera grande) y no rechaza explícitamente divisas distintas a `MXN`/`USD` — caen al `else` y se mezclan en el bucket MXN silenciosamente.
- No existe un helper público que devuelva `{ saldoPendienteMXN, saldoPendienteUSD }` para consumidores que sólo necesitan los saldos agrupados (dashboards, exports, alertas).

## Cambios

### 1. `src/services/facturas/cobranza.ts`
- **Nuevo helper exportado** `agruparSaldosPorMoneda(filas)`:
  - Firma: `(filas: FacturaCobranza[]) => { saldoPendienteMXN: number; saldoPendienteUSD: number; porMoneda: Record<string, number>; descartadas: number }`.
  - Itera una sola vez; para cada `f` con `saldo > 0`:
    - Empuja a un array por bucket según `f.moneda`.
    - Si `f.moneda` no es `"MXN"` ni `"USD"`, registra en `porMoneda` y `descartadas++` sin contaminar los buckets canónicos.
  - Reduce los buckets con `sumarMontos` (currency.js, precisión 2) desde `@/lib/financial/financialUtils`.
  - Si `descartadas > 0`, `console.warn` listando las monedas atípicas detectadas.
- **Refactor de `calcularKPIs`** para usar la misma estrategia:
  - Reemplazar los `+=` planos por arrays-por-bucket (`total`, `vencido`, `por_vencer_7d` × `MXN`/`USD`) y un `sumarMontos` final por cada uno.
  - Guard explícito: `if (f.moneda !== "MXN" && f.moneda !== "USD") continue;` (con `console.warn` agregado al final si hubo alguna).
  - `total_mxn`/`total_usd` ahora se calculan vía `agruparSaldosPorMoneda` reutilizando el helper (single source of truth) — luego se enriquecen con `vencido_*` y `por_vencer_7d_*`.
- Sin cambios a `fetchCobranza`, `FacturaCobranza`, `KPIsCobranza` (firmas estables).

### 2. Test nuevo — `src/services/facturas/__tests__/cobranza.test.ts`
Cubrir lógica pura sin tocar Supabase:
- `agruparSaldosPorMoneda` separa MXN y USD sin mezclar.
- Filas con `saldo <= 0` se ignoran.
- Filas con `moneda` ajena (ej. `"EUR"`) NO contaminan los buckets canónicos; quedan en `porMoneda.EUR` y `descartadas === 1`.
- Precisión: `[0.1, 0.1, 0.1]` MXN → `saldoPendienteMXN === 0.3` (vs `0.30000000000000004` con `+=`).
- `calcularKPIs`: `total_mxn`/`total_usd` coinciden con `agruparSaldosPorMoneda`; `vencido_*` y `por_vencer_7d_*` se separan correctamente por moneda.

### 3. Versionado
- `src/constants/appVersion.ts` → `12.61.6`.
- `CHANGELOG.md`: entrada `## [12.61.6] - 2026-06-08` describiendo el helper y la precisión.

## Notas técnicas
- Sin migraciones; sólo lógica de servicio.
- Sin cambios al hook `useCobranza` (los KPIs mantienen su shape).
- Alineado con `mem://technical/financial-calculations-standards` (acumuladores monetarios vía `sumarMontos`/`currency.js`).

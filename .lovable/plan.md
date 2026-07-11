## Problema

En `/cartera`, las tarjetas "Saldo total" y "Vencido" suman todos los saldos como si fueran la misma moneda y muestran el resultado con etiqueta MXN. Un saldo de 1,000 USD se cuenta como 1,000 MXN — la cifra está inflada al revés (subestimada) según el mix real de facturas.

La causa está en `src/features/bandejas/domain/aggregates.ts → resumirCartera()`: acumula `totalSaldo` y `vencidoSaldo` sin distinguir `moneda`. La pantalla `/cartera` es la única que consume esa función; el resto del módulo de cobranza (`cobranzaAggregates.ts`, bandeja "Por cobrar") ya separa por moneda correctamente.

## Solución

Reescribir `resumirCartera` para devolver totales **nativos por moneda** (MXN, USD, otras) más un **equivalente en MXN** usando el tipo de cambio vigente. Las 3 tarjetas de `/cartera` se rediseñan para mostrar en la línea principal los totales nativos ("$X MXN · $Y USD") y, debajo en texto pequeño y muted, el equivalente consolidado en MXN. Si alguna factura USD no puede convertirse (falta TC), se indica con un aviso discreto.

## Cambios

1. **`src/features/bandejas/domain/aggregates.ts`**
   - `CarteraSummary` pasa a exponer:
     ```
     total, saldosNativos: { MXN, USD, otras: Record<string, number> },
     vencidasCount, vencidoNativo: { MXN, USD, otras: Record<string, number> }
     ```
   - Sin conversión de FX aquí (función pura, sin dependencias de red).
   - Reutiliza `sumarMontos` de `financialUtils` para evitar drift de punto flotante.

2. **Nuevo helper** `src/features/bandejas/domain/carteraFx.ts` (puro, testeable):
   - `equivalenteMxn(nativos, tcUsdMxn) → { totalMxn, facturasSinTc }`.
   - Convierte USD × TC; MXN tal cual; monedas ajenas se reportan como "sin TC" (no se mezclan).

3. **`src/features/bandejas/routes/Cartera.tsx`**
   - Consumir `useExchangeRates()` (ya existente) para obtener `usdMxn`.
   - Rediseñar las 3 tarjetas:
     - **Facturas con saldo**: sin cambio (es un conteo).
     - **Saldo total**: línea 1 → `$X MXN · $Y USD` (omite monedas en cero); línea 2 (muted, pequeña) → `≈ $Z MXN equivalente`. Si `facturasSinTc > 0`, mostrar `(N sin TC)` en tooltip.
     - **Vencido (N)**: mismo patrón, con color `text-destructive` sólo en la línea principal.
   - Usar `formatCurrency` de `@/lib/formatters` con la moneda correcta por segmento — nunca hardcodear MXN cuando el número es USD.

4. **Tests**
   - `src/features/bandejas/domain/__tests__/aggregates.test.ts`: agregar casos con mix MXN+USD y con monedas ajenas para verificar que los buckets no se contaminan.
   - `src/features/bandejas/domain/__tests__/carteraFx.test.ts` (nuevo): equivalente MXN con TC válido, con TC=0 (reporta `facturasSinTc`), y con moneda desconocida.

5. **Bitácora**
   - `CHANGELOG.md`: nueva entrada `## [13.253.2]` con nota "Cartera: KPIs de saldo separan MXN/USD nativos y muestran equivalente MXN".
   - Bump `APP_VERSION` a `13.253.2` en `src/constants/appVersion.ts`.

## Fuera de alcance

- No se toca `cobranzaAggregates.ts` ni la bandeja "Por cobrar" (ya separan por moneda).
- No se cambia la tabla de `/cartera`, solo las 3 tarjetas superiores.
- No se agregan conversiones EUR — hoy `cartera_pendiente` sólo devuelve MXN/USD; si aparece otra moneda se lista aparte sin mezclarse.

## Detalle técnico

Diagrama de dependencia final:

```text
Cartera.tsx
  ├─ useCarteraPendiente()      → filas con {saldo, moneda}
  ├─ useExchangeRates()         → {usdMxn}
  ├─ resumirCartera(filas)      → nativos por moneda (puro)
  └─ equivalenteMxn(nativos, tc) → total MXN + facturasSinTc (puro)
```

Contrato de `equivalenteMxn`:
- `MXN` → suma directa.
- `USD` → suma × `tcUsdMxn` si `tcUsdMxn > 1`; si no, cuenta como `facturasSinTc`.
- Otras monedas → siempre `facturasSinTc`.

Riesgo bajo: cambio localizado a una pantalla + una función pura; los tests de `aggregates` existentes se actualizan.

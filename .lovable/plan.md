## Objetivo

Refactorizar los 3 módulos financieros para realizar toda la aritmética con `currency.js`, eliminando errores de punto flotante sin alterar firmas ni romper consumidores (`CotizacionDetalle`, `ResumenTotalesCotizacion`, `useEmbarqueFinancials`, generadores de PDF, etc.).

## Paso 0 — Dependencia

- `bun add currency.js` (no está instalada actualmente).
- Convención de uso interno:
  ```ts
  import currency from "currency.js";
  const c = (n: number) => currency(n, { precision: 4 }); // 4 decimales internos para no perder precisión en %
  ```
  La precisión se eleva a 4 para `calcularMargen` (porcentaje) y se mantiene en 2 por defecto para montos. Cuando una función deba devolver "monto monetario", se usará `precision: 2`; cuando devuelva razón/porcentaje, `precision: 4`. **No** se usa `.toFixed()` ni `Math.round`; se confía en el redondeo interno de currency.js (`.value`).

## Archivo 1 — `src/lib/financial/financialUtils.ts`

Reemplazos uno a uno, preservando firmas y tipos exactos:

| Función | Implementación nueva |
|---|---|
| `calcularSubtotal(cantidad, precioUnitario)` | `currency(precioUnitario).multiply(cantidad).value` |
| `calcularIVA(monto, tasa=TASA_IVA)` | `currency(monto).multiply(tasa).value` |
| `calcularTotalConIVA(monto, tasa=TASA_IVA)` | `currency(monto).add(currency(monto).multiply(tasa)).value` (equivale a `monto * (1 + tasa)` sin desbordes) |
| `calcularMargen(venta, costo)` | early-return `0` si `venta === 0`; luego `currency(venta, {precision:4}).subtract(costo).divide(venta).multiply(100).value` |
| `calcularUtilidad(venta, costo)` | `currency(venta).subtract(costo).value` |
| `convertirAMXN(monto, moneda, tcUSD, tcEUR)` | `USD → currency(monto).multiply(tcUSD).value`; `EUR → currency(monto).multiply(tcEUR).value`; `MXN → monto` (sin tocar) |
| `convertirAUSD(monto, moneda, tcUSD, tcEUR)` | `MXN → currency(monto).divide(tcUSD).value`; `EUR → currency(monto).multiply(tcEUR).divide(tcUSD).value`; `USD → monto` |

Notas:
- `TASA_IVA = 0.16` y el tipo `Moneda` se mantienen exportados sin cambios.
- Para `MXN`/`USD` "passthrough" se devuelve el input tal cual para que los tests que usan `.toBe(500)` y `.toBe(100)` sigan pasando.

## Archivo 2 — `src/lib/financial/profitUtils.ts`

`calcularTotalesPL(filas)` se reescribe acumulando con currency.js:

```ts
const totalCostoC = filas.reduce(
  (acc, f) => acc.add(currency(f.costo_unitario).multiply(f.cantidad)),
  currency(0),
);
const totalVentaC = filas.reduce(
  (acc, f) => acc.add(currency(f.precio_venta).multiply(f.cantidad)),
  currency(0),
);
const totalCosto = totalCostoC.value;
const totalVenta = totalVentaC.value;
const profit = calcularUtilidad(totalVenta, totalCosto);
const porcentaje = calcularMargen(totalVenta, totalCosto);
```

Firma `TotalesPL` y export por defecto **no cambian**.

## Archivo 3 — `src/lib/financial/costosUSD.ts`

- `aUSD(monto, moneda, tcUSD, tcEUR)`: delega en el nuevo `convertirAUSD` (ya está con currency.js). Sin cambios de firma.
- `sumarEnUSD(items, tcUSD, tcEUR)`: se reescribe la reducción para acumular en currency:

```ts
return items
  .reduce(
    (acc, item) => acc.add(convertirAUSD(item.monto, item.moneda as Moneda, tcUSD, tcEUR)),
    currency(0),
  )
  .value;
```

Esto evita el clásico drift `0.1 + 0.2` al sumar muchos conceptos.

## Validación

1. Ejecutar `bunx vitest run src/lib/financial` — los tests existentes (`financialUtils.test.ts`, `financialUtils.edge.test.ts`, `profitUtils.test.tsx`) deben pasar sin tocar aserciones.
2. Verificar smoke en consumidores: `ResumenTotalesCotizacion`, `useEmbarqueFinancials`, `conceptosTables.ts`, `services/cliente/financials.ts`. Como las firmas y los tipos de retorno (`number`) se conservan, no se requieren cambios en estos archivos.
3. `rg "Math\.round\(|\.toFixed\("` dentro de `src/lib/financial/` debe devolver vacío.

## Versionado / Changelog

- Bump `APP_VERSION` a `10.1.4` (patch).
- Entrada en `src/content/changelog/v8/chunks/0.ts` + `src/content/changelogData.ts` + `src/pages/dashboard/Changelog.tsx`: "Aritmética financiera migrada a currency.js para eliminar errores de punto flotante (sin cambios de API)".

## Lo que NO se hace

- No se cambian firmas, nombres, ni tipos exportados.
- No se modifican consumidores aguas arriba.
- No se introduce `toFixed`/`Math.round`.
- No se altera la semántica del passthrough MXN/USD.

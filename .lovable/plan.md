## Problema

El card **"Saldo total"** de `/cxp/por-pagar` suma `saldo` de todas las facturas sin importar la moneda y muestra el resultado como si fuera MXN. Si hay facturas en USD y MXN mezcladas se están sumando "peras con manzanas" y el número está inflado/mal.

## Solución

Mostrar el saldo total **homologado a MXN en grande**, con **chips chiquitos abajo desglosando por moneda nativa** (`MXN $X · USD $Y · EUR $Z`).

### 1. Backend — exponer `tipo_cambio_usd` en el RPC

Migración que reemplaza `public.cxp_por_pagar()` añadiendo dos columnas al RETURNS:
- `tipo_cambio_usd numeric` — desde `proveedor_facturas.tipo_cambio_usd`
- `tipo_cambio_eur numeric` — desde `proveedor_facturas.tipo_cambio_eur`

No cambia ningún dato existente, solo añade columnas.

### 2. Tipos y servicio

`src/features/bandejas/services/bandejas.ts` → añadir `tipo_cambio_usd: number | null` y `tipo_cambio_eur: number | null` a `CxpPorPagarRow`.

### 3. Función de agregación pura

Reemplazar `resumirCxpPorPagar` en `src/features/bandejas/domain/aggregates.ts`:

```ts
export interface CxpPagarSummary {
  total: number;
  vencidas: number;
  saldoMXN: number;       // homologado
  porMoneda: { MXN: number; USD: number; EUR: number };
  faltaTipoCambio: number; // count de facturas USD/EUR sin TC (no contadas en saldoMXN)
}
```

Reglas:
- Suma nativa por moneda → `porMoneda[r.moneda]`.
- Para homologar:
  - `MXN` → suma tal cual.
  - `USD` → `saldo * tipo_cambio_usd` (si TC nulo o 0 → no suma al homologado, incrementa `faltaTipoCambio`).
  - `EUR` → análogo con `tipo_cambio_eur`.

### 4. UI del card "Saldo total"

```tsx
<Card>
  <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
  <CardContent>
    <div className="text-2xl font-semibold tabular-nums">
      {formatCurrency(saldoMXN, "MXN")}
    </div>
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
      {porMoneda.MXN > 0 && <span>MXN {formatCurrencyCompact(porMoneda.MXN, "MXN")}</span>}
      {porMoneda.USD > 0 && <span>· USD {formatCurrencyCompact(porMoneda.USD, "USD")}</span>}
      {porMoneda.EUR > 0 && <span>· EUR {formatCurrencyCompact(porMoneda.EUR, "EUR")}</span>}
    </div>
    {faltaTipoCambio > 0 && (
      <p className="text-[10px] text-warning mt-0.5">
        {faltaTipoCambio} factura{faltaTipoCambio>1?"s":""} sin TC capturado — no incluida{faltaTipoCambio>1?"s":""} en homologado.
      </p>
    )}
  </CardContent>
</Card>
```

### 5. Tests

Actualizar `src/features/bandejas/domain/__tests__/aggregates.test.ts` con casos:
- Solo MXN.
- USD con TC → suma homologado correcto.
- USD sin TC → no suma, incrementa `faltaTipoCambio`.
- Mezcla MXN + USD + EUR.

### 6. Changelog + versión

- `appVersion.ts` → `13.99.1`.
- Entrada en `CHANGELOG.md` describiendo el bug y el fix.

## Archivos afectados

```text
supabase/migrations/<nuevo>.sql                        (CREATE OR REPLACE cxp_por_pagar)
src/features/bandejas/services/bandejas.ts             (tipos)
src/features/bandejas/domain/aggregates.ts             (resumirCxpPorPagar)
src/features/bandejas/domain/__tests__/aggregates.test.ts
src/features/bandejas/routes/CxpPorPagar.tsx           (card Saldo total)
src/constants/appVersion.ts
CHANGELOG.md
```

## Verificación

1. `bunx vitest run src/features/bandejas/domain/__tests__/aggregates.test.ts`.
2. `psql -c "SELECT moneda, sum(saldo) FROM cxp_por_pagar() GROUP BY moneda;"` para confirmar montos por moneda.
3. Inspección visual en `/cxp/por-pagar`.

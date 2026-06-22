## Objetivo

Cambiar la barra del card **"Arribos este mes"** para que muestre **qué % de los gastos operativos del mes ya está cubierto por el profit proyectado**. Sirve como semáforo del punto de equilibrio mensual: "¿ya pagué la nómina, renta, servicios, comisiones, etc. con lo que voy a ganar este mes?".

Decisiones tomadas:
- **Comportamiento de la barra:** se llena máximo al 100%. El número al lado muestra el % real (puede ser 150%, 200%…).
- **Origen del denominador:** **gastos reales del mes** = facturas de proveedor con categoría "GastoOperativo" + liquidaciones de comisión del mes (no incluye costos logísticos del embarque, esos ya están restados dentro del profit).

## Fórmula

```text
% cubierto = ( profitMXN_proyectado / gastosOperativosMXN_del_mes ) * 100

barra_visual = min(100, % cubierto)
etiqueta     = "{% real} % de gastos fijos cubierto"
```

Casos borde:
- `gastosOperativosMXN = 0` → barra al 0%, label "Sin gastos operativos del mes".
- `profitMXN < 0` (pérdida) → barra al 0%, color destructive, label "0% — pérdida proyectada".

## Pasos

### 1. Backend — exponer `gastosOperativosMXN` en `dashboard_summary()`

Migración nueva que reemplaza `public.dashboard_summary()` y añade un CTE `gastos_op_mes` dentro del bloque `arribosEsteMes`:

```sql
gastos_op_mes AS (
  SELECT
    COALESCE(SUM(
      CASE WHEN pf.moneda = 'MXN' THEN pf.total
           WHEN pf.tipo_cambio_usd IS NOT NULL THEN pf.total * pf.tipo_cambio_usd
           ELSE pf.total END
    ), 0)
    +
    COALESCE((SELECT SUM(total_mxn) FROM liquidaciones_comision
              WHERE periodo = to_char(v_inicio_mes, 'YYYY-MM')
                AND (organization_id = current_user_org_id()
                     OR has_role(auth.uid(), 'super_admin'))), 0)
    AS val
  FROM proveedor_facturas pf
  JOIN proveedores p ON p.id = pf.proveedor_id
  WHERE p.categoria = 'GastoOperativo'
    AND pf.deleted_at IS NULL
    AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
    AND (pf.organization_id = current_user_org_id()
         OR has_role(auth.uid(), 'super_admin'))
)
```

Agregar al JSON de `arribos_mes`:
```sql
'gastosOperativosMXN', COALESCE((SELECT val FROM gastos_op_mes), 0)
```

### 2. Parser y tipo

- `src/features/dashboard/domain/parsers/dashboardTypes.ts`: añadir `gastosOperativosMXN: number` a `ArribosEsteMes` + `EMPTY_ARRIBOS`.
- `src/features/dashboard/domain/parsers/dashboardSchemas.ts`: añadir `gastosOperativosMXN: numOrCoerce` al schema.
- `src/features/dashboard/domain/parsers/dashboard.ts`: incluirlo en el mapeo de `parseArribosEsteMes`.

### 3. `ArribosCard.tsx`

- Añadir campo `gastosOperativosMXN` al interface local `ArribosEsteMes`.
- Reemplazar el cálculo de `pct` (que hoy es `yaLlegaron/total`) por:
  ```ts
  const gastos = arribosEsteMes.gastosOperativosMXN;
  const profit = Math.max(arribosEsteMes.profitMXN, 0);
  const pctReal = gastos > 0 ? Math.round((profit / gastos) * 100) : 0;
  const pctBarra = Math.min(100, pctReal);
  ```
- El componente `Progress` usa `value={pctBarra}` con color dinámico:
  - `pctReal >= 100` → verde (success)
  - `pctReal >= 50` → ámbar (warning)
  - `pctReal < 50` o pérdida → rojo (destructive)
- A la derecha de la barra mostrar `{pctReal}%` (puede ser > 100).
- Agregar un **Tooltip** sobre la barra explicando:
  - "Profit proyectado: $X MXN"
  - "Gastos operativos del mes: $Y MXN"
  - "Cubres el Z% de los gastos fijos"
  - Si Z ≥ 100: "Ya cubriste tus gastos fijos del mes. Lo demás es utilidad neta."
  - Si Z < 100: "Faltan $ (gastos − profit) MXN para cubrir tus gastos fijos."

### 4. Texto pequeño debajo (label)

Cambiar el `<p>` actual ("totales del mes" o equivalente) por:
- `"% de gastos fijos cubierto"` (a la derecha del % numérico).

### 5. Changelog y versión

- `appVersion.ts` → `13.99.0` (cambio semántico de la barra).
- `CHANGELOG.md` entrada `[13.99.0] - 2026-06-22` describiendo el cambio + nuevo dato `gastosOperativosMXN` del RPC.

## Detalles técnicos

- La migración solo toca `dashboard_summary()` (no `dashboard_stats` legacy ni `dashboard_details`, ya que el front consume summary+details combinados y `arribosEsteMes` viene de summary).
- `liquidaciones_comision.periodo` ya es formato `YYYY-MM` (mismo que usa `vsReal.ts`).
- Filtrar `proveedor_facturas` por `categoria = 'GastoOperativo'` evita sumar costos logísticos (esos ya viven dentro de `costoMXN` del embarque y por tanto ya restan en el profit).
- No se toca lógica de profit, conversión de divisas ni tooltip de profit (el rediseñado en 13.98.5 queda intacto).

## Archivos afectados

```text
supabase/migrations/<nuevo>.sql            (CREATE OR REPLACE dashboard_summary)
src/features/dashboard/domain/parsers/dashboardTypes.ts
src/features/dashboard/domain/parsers/dashboardSchemas.ts
src/features/dashboard/domain/parsers/dashboard.ts
src/features/dashboard/components/statusCards/ArribosCard.tsx
src/constants/appVersion.ts
CHANGELOG.md
```

## Verificación

1. `bunx vitest run src/features/dashboard/domain/parsers/__tests__/dashboardSchemas.test.ts` (extender el test para validar el nuevo campo).
2. Playwright en `/inicio` para confirmar visualmente que la barra y el % se actualizan.
3. `psql -c "SELECT dashboard_summary()->'arribosEsteMes'->>'gastosOperativosMXN';"` para confirmar el valor en DB real.

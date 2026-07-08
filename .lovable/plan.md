## Diagnóstico

En la bandeja **Compras → Por capturar**, la columna **Avance** muestra `monto_facturado / costos_presupuestados` formateados siempre como **MXN**. Pero al revisar la base de datos:

- `conceptos_costo` tiene `moneda` (MXN/USD) sin tipo de cambio, y el RPC `cxp_por_capturar` **suma `cc.monto` sin importar la divisa**.
- `proveedor_facturas.total` también se suma sin separar por moneda.

Ejemplo real: el embarque `ELIMP00305` tiene presupuestado **6,410 USD**, pero en la tabla aparece como **$6,410.00 MXN**. Cuando un embarque mezcla MXN y USD (como `ELIMP00300`: 60,500 MXN + 354 USD), se suman como si fueran la misma moneda → **60,854 "MXN"**, cifra sin sentido.

Analogía: es como sumar pesos y dólares en la misma cuenta del changuito del súper — el total no significa nada.

## Cambios propuestos

### 1. RPC `cxp_por_capturar` (migración)
Devolver montos separados por moneda:
- `presupuestado_mxn`, `presupuestado_usd`
- `facturado_mxn`, `facturado_usd`
- (Se conservan `facturas_capturadas`, `ultima_factura_fecha`, `dias_desde_ultima_factura`.)

Los campos se calculan con `SUM(cc.monto) FILTER (WHERE cc.moneda = 'MXN')` y equivalente para USD, y `SUM(pf.total) FILTER (WHERE pf.moneda = 'MXN'/'USD')` sobre facturas no canceladas.

### 2. `CxpPorCapturarRow` (`src/features/bandejas/services/bandejas.ts`)
Reemplazar `costos_presupuestados` y `monto_facturado` por los cuatro campos por moneda.

### 3. Columna "Avance" (`src/features/bandejas/components/cxpPorCapturarColumns.tsx`)
- Mostrar dos líneas cuando exista mezcla: una para MXN y otra para USD, cada una con `facturado / presupuestado` formateados en su divisa.
- Barra de progreso: usar el porcentaje de la moneda con mayor presupuesto (evita mezclar). Cuando sólo hay una moneda, se muestra una sola línea (comportamiento actual).

### 4. Filtro/estatus (`useCxpPorCapturarFilters.ts` + `estatusDeFila`)
Ajustar `estatusDeFila` para clasificar "sin / parcial / completo" comparando **por moneda**:
- `completo` si todas las monedas con presupuesto > 0 están cubiertas (≥99%).
- `sin` si no hay ninguna factura.
- `parcial` en cualquier otro caso.

### 5. Agregado en `aggregates.ts` (`resumirCxpPorCapturar`)
`totalPresupuestado` se separa en `totalPresupuestadoMxn` y `totalPresupuestadoUsd`. Actualizar el consumidor (`useBandejas` / KPI) para mostrar ambos.

### 6. Tests
Actualizar:
- `src/features/bandejas/domain/__tests__/aggregates.test.ts` (nuevos campos)
- `src/features/bandejas/hooks/__tests__/useCxpPorCapturarFilters.test.ts` (estatus por moneda)

### 7. Versionado y CHANGELOG
- `APP_VERSION` → `13.219.2`
- Entrada en `CHANGELOG.md` (root) con analogía del "changuito con dos monederos".

## Fuera de alcance
- No se homologa USD a MXN con un TC estimado (los conceptos de costo no tienen TC); mostrar por moneda es más fiel.
- No se toca la bandeja **Por pagar** (ésa ya separa por moneda y sí tiene TC en `proveedor_facturas`).

## Detalles técnicos

```sql
-- Migración: reemplaza cxp_por_capturar con filtered aggregates por moneda.
CREATE OR REPLACE FUNCTION public.cxp_por_capturar()
RETURNS TABLE (
  embarque_id uuid, expediente text, cliente_nombre text,
  presupuestado_mxn numeric, presupuestado_usd numeric,
  facturado_mxn numeric, facturado_usd numeric,
  facturas_capturadas int, ultima_factura_fecha date, dias_desde_ultima_factura int
) ... $$
  SELECT ...
    COALESCE(SUM(cc.monto) FILTER (WHERE cc.moneda='MXN'), 0),
    COALESCE(SUM(cc.monto) FILTER (WHERE cc.moneda='USD'), 0),
    (SELECT COALESCE(SUM(total) FILTER (WHERE moneda='MXN'),0) FROM proveedor_facturas ...),
    ...
  HAVING COALESCE(SUM(cc.monto),0) > 0
$$;
```

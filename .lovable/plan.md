# Profit homologado a MXN en el Dashboard

## Problema actual

Hoy el dashboard muestra "Profit USD proyectado" en la tarjeta de "Arribos este mes" y números en USD en las tablas de Profit y de Mes siguiente. Al revisar la base de datos encontramos algo más grave que el problema reportado:

La función `profit_por_embarque()` **solo suma conceptos en USD** e ignora por completo los conceptos en MXN y EUR. Eso significa que cualquier embarque cuya venta o costo se haya capturado en pesos hoy aparece con profit incorrecto (sub-reportado) en todo el Dashboard.

Hay que (a) homologar los cálculos a MXN usando el TC guardado en cada embarque, y (b) reemplazar la métrica visible por "Profit MXN proyectado" con un tooltip de desglose.

## Alcance acordado

- **Solo MXN** como cifra visible, con tooltip que muestre el desglose (venta MXN, costo MXN, y cuánto vino convertido desde USD/EUR).
- **TC del embarque** ya guardado (`tipo_cambio_usd`, `tipo_cambio_eur`) — no recalculamos con TC de mercado.
- **Todo el Dashboard principal** (`/`): tarjeta "Arribos este mes", tabla "Profit de arribos", tabla "Embarques mes siguiente" y su resumen. *No* tocamos Operaciones, Facturación, Reportes ni Portal.

## Cambios

### 1. Base de datos — RPC `profit_por_embarque()`

Reemplazar para que devuelva totales en MXN homologados usando el TC del embarque, y exponga desglose:

```text
TABLE(
  embarque_id uuid,
  venta_mxn numeric,        -- venta total homologada
  costo_mxn numeric,        -- costo total homologado
  venta_mxn_from_usd numeric, costo_mxn_from_usd numeric,
  venta_mxn_from_eur numeric, costo_mxn_from_eur numeric,
  venta_mxn_native  numeric, costo_mxn_native  numeric,
  tipo_cambio_usd numeric, tipo_cambio_eur numeric
)
```

Filtra `deleted_at IS NULL` en `conceptos_venta` y `conceptos_costo`, y respeta el filtro por organización ya existente.

### 2. RPC `dashboard_summary()` y `dashboard_details()`

- En `arribosEsteMes`: agregar `profitMXN`, `ventaMXN`, `costoMXN`, y desglose `venta_from_usd`, `venta_from_eur`, `venta_native`, idem costos. Conservar `profitUSD` temporalmente para no romper otros consumidores hasta que el front migre (luego se elimina).
- En `profitArribosEsteMes` y `embarquesMesSiguiente`: agregar `ventaMXN`, `costoMXN`, `profitMXN`, `margenMXN` por embarque.
- En `resumenMesSiguiente`: agregar `ventaMXN`, `costoMXN`, `profitMXN`.

### 3. Parsers (`src/lib/parsers/dashboard.ts`)

- Extender `ArribosEsteMes`, `EmbarqueConProfit`, `EmbarqueMesSiguiente`, `ResumenFacturacion` con los campos MXN y el desglose.
- Mantener compatibilidad si el payload trae solo USD (defaults a 0).

### 4. UI — `src/components/dashboard/`

- **`DashboardStatusCards.tsx`** (tarjeta "Arribos este mes"): cambiar la métrica a `profitMXN`, label "Profit MXN proyectado", envolver en `Tooltip` con el desglose (venta MXN total, costo MXN total, y "de los cuales X vienen de USD a TC Y", etc.). Formato `formatCurrencyCompact(..., "MXN")`.
- **`ProfitTable.tsx`**: columnas Venta / Costo / Profit / Margen en MXN. Tooltip por fila con TC usado y desglose por moneda.
- **`EmbarquesActivosTable.tsx`** y su resumen del mes siguiente: idem, MXN visible + tooltip con desglose.

### 5. Tests y cleanup

- Actualizar `src/lib/parsers/__tests__/dashboard.test.ts` para los nuevos campos.
- Verificar que `Operaciones.tsx`, `useTabProyeccionController` y `useRentabilidadClientes` (que también importan `profit_por_embarque`) sigan funcionando — esos módulos usan otra ruta de cálculo (`financialUtils`) y el cambio del RPC no los rompe, pero hay que probar.

### 6. Versión y changelog

- Bump `APP_VERSION` a **8.212.0**.
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts` describiendo: corrección de profit homologado a MXN en Dashboard, fix de `profit_por_embarque()` que ignoraba MXN/EUR, tooltip con desglose.

## Notas técnicas

- Conservamos `profitUSD` en los payloads una versión más para no romper consumidores externos; queda marcado como deprecado en el código.
- No se cambia ningún cálculo financiero fuera del Dashboard — `financialUtils.convertirAMXN` ya es la fuente de verdad en el resto de la app y la lógica SQL nueva sigue exactamente esa misma fórmula (`monto * tc_moneda`).
- El tooltip usa `formatCurrency(..., "MXN")` para los desgloses (no compacto), para que se vea el monto exacto.

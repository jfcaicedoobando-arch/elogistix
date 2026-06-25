## Diagnóstico verificado contra la base de datos

En junio 2026 (rango actual del filtro):

- 12 facturas en USD, total **$102,193.20 USD**, todas en estado *Emitida*.
- 0 facturas en MXN.
- Las 12 facturas tienen `tipo_cambio = NULL`.

El servicio `fetchDashboardEjecutivoFacturacion` calcula el equivalente MXN así:

```ts
const tc = moneda === "MXN" ? 1 : Number(tipoCambio ?? 0);
return Number(monto) * (tc || 1);   // ← si tc=0, fallback a 1
```

Con `tipo_cambio` NULL, `tc` cae a 0 y el `|| 1` lo convierte en 1. Resultado: **102,193.20 USD se suma como si fueran 102,193.20 MXN**. Por eso el número del header y el USD del footer son casi idénticos: literalmente es el mismo número, mal etiquetado.

## Causa raíz

El `|| 1` "esconde" facturas USD sin tipo de cambio capturado, dándole al usuario un KPN MXN incorrecto en silencio.

## Cambios propuestos (solo presentación / cálculo del KPI, sin tocar datos ni RLS)

### 1. `src/features/facturacion/services/dashboardEjecutivo.ts`
- Quitar el fallback silencioso `|| 1` para monedas distintas de MXN.
- Si una factura USD no tiene `tipo_cambio`, usar el **tipo de cambio del día más cercano** desde la tabla/servicio de tipos de cambio ya existente en el proyecto (`exchange-rates`). Si no hay tipo de cambio disponible, **excluir esa factura de la suma MXN** y contarla como "pendiente de TC".
- Retornar también un nuevo campo `facturas_sin_tc: number` para poder advertir al usuario.

### 2. `src/features/facturacion/components/DashboardEjecutivoFacturacion.tsx`
- Si `facturas_sin_tc > 0`, mostrar un pequeño badge ⚠️ junto al KPI "Facturado mes" con tooltip: *"N facturas USD sin tipo de cambio capturado no se incluyen en el equivalente MXN. Captura el TC en cada factura para que el total cuadre."*
- Mantener el tooltip explicativo ya existente.

### 3. `src/features/facturacion/components/FacturasEmitidasFooter.tsx`
- Agregar una fila con el **MXN equivalente total** (`Subtotal MXN + Subtotal USD × TC` por factura), usando exactamente la misma fórmula corregida que el header — así ambos números cuadran cuando el filtro está en "mes en curso".
- Marcar visualmente cuántas facturas USD del filtro no tienen TC.

### 4. Tests
- Ampliar `sumarFacturas.test.ts` y agregar un test al servicio del dashboard para cubrir el caso `tipo_cambio = NULL` (no debe inflar el MXN).
- Mantener cobertura ≥38%.

## Lo que NO voy a cambiar

- No voy a actualizar `tipo_cambio` en las facturas existentes (eso es decisión del usuario / dato operativo).
- No tocaré RLS, migraciones, ni el flujo de captura/emisión de facturas.
- No cambiaré el filtro de fechas ni la lógica de paginación.

## Versionado

Bump a `13.135.72` + entrada en `CHANGELOG.md` describiendo el fix.

¿Procedo?

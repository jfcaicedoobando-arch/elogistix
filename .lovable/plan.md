# Rehacer bandeja "Embarques sin factura" — basada en ETA

## Problema

Hoy la bandeja usa **ETD + 5 días** como disparador. En importación marítima CN→MX una travesía dura 20-40 días, así que un embarque con ETD hace 6 días **ni siquiera ha llegado al puerto** — es imposible que le falte factura porque aún no cruza aduana. Genera ruido y confunde.

## Criterio nuevo (aprobado)

Un embarque cae en la bandeja **sólo si**:

1. **`eta` capturado** (embarques sin ETA se excluyen).
2. **`eta ≤ hoy`** — el contenedor ya llegó o llega hoy.
3. **No tiene CFDI real** por expediente (sin cambio).
4. **No está cubierto por aceptación histórica** (sus conceptos no están todos en proformas `facturada` — sin cambio).
5. Se mantiene el corte del modelo nuevo (ETA ≥ 2026-04-01) para no revivir embarques ya cerrados con back-fill.

## Cambios de código

### `src/features/facturacion/services/huecoFacturacion/fetchSources.ts`
- `fetchEmbarquesParaHueco`: filtrar por `eta` (no `etd`), con `not("eta", "is", null)` + `lte("eta", hoyIso)` + `gte("eta", "2026-04-01")`. Ordenar por `eta` ascendente.

### `src/features/facturacion/services/huecoFacturacion/index.ts`
- Cambiar cálculo de `limiteIso`: ya no es `hoy - 5`, ahora es `hoy` (para el filtro por ETA vencido).
- Eliminar `DIAS_UMBRAL = 5` (o dejarlo en 0).

### `src/features/facturacion/services/huecoFacturacion/buildFilas.ts`
- Renombrar `diasDesdeEtd` → `diasDesdeEta` en `FilaHueco`.
- `construirFilaHueco`: guardarse contra `!e.eta` (retornar null); calcular `diasDesdeEta` con `e.eta`.

### `src/features/facturacion/components/huecoFacturacionColumns.tsx`
- Cambiar columna "ETD" por "ETA".
- Cambiar columna "Días desde ETD" por "Días desde ETA".
- Ordenar la tabla por `eta` ascendente (los que llegaron hace más tiempo arriba).

### `src/features/facturacion/components/bandejas/BandejaTabs.tsx`
- Actualizar tooltip: "Embarques cuyo contenedor ya llegó (ETA ≤ hoy) y aún no tienen CFDI. Puede que falte generar la proforma o convertirla a factura."

### Tests
- `src/features/facturacion/services/huecoFacturacion/__tests__/buildFilas.test.ts`: actualizar fixtures y assertions (eta en vez de etd; ya sin cálculo de 5 días).
- Añadir caso: embarque con ETA futuro → no aparece. Embarque sin ETA → no aparece. Embarque con ETA de ayer y sin CFDI → sí aparece.

### Versionado y bitácora
- Bump `APP_VERSION` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` explicando el cambio de criterio (ETD → ETA).

## Fuera de alcance
- No cambio la lógica de "aceptación histórica" (proformas facturadas de back-fill).
- No cambio el nombre de la bandeja (`embarques-sin-factura`), sólo el tooltip.
- No cambio otros KPIs de facturación que puedan usar ETD (los reviso pero no los toco en este plan).

## Analogía
Antes era como avisar "prepara la factura" el día que sale el barco de Shanghái — sin sentido porque tardará 30 días en llegar. Ahora avisa cuando el barco ya está tocando puerto en Manzanillo/Lázaro, que es cuando de verdad necesitas la factura para cruzar aduana.

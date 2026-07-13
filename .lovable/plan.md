# Plan — Mejoras al flujo de cotización LCL

## Objetivo
Adaptar el wizard de cotización marítimo LCL a la realidad operativa: el flete LCL se cotiza por **W/M (peso o volumen, el mayor)** contra un consolidador, y las tarifas cambian por embarque. Hoy el paso obliga a vincular una tarifa como si fuera FCL.

## Cambios funcionales

### 1. Tarifa opcional en LCL
- En LCL, la sección de tarifa pasa a ser **sugerencia**, no requisito.
- Si existe una tarifa vigente para la ruta se muestra y se puede vincular (para heredar recargos, condiciones y días libres almacenaje LCL).
- Si no hay tarifa o el ejecutivo prefiere capturar manual, el paso "Tarifa" queda en verde y se abre un bloque de captura manual.
- FCL sigue igual (tarifa obligatoria).

### 2. Bloque de flete manual LCL (cuando no hay tarifa)
Nuevos campos en el paso, sólo visibles en LCL sin tarifa vinculada:
- **Tarifa W/M** (USD por W/M).
- **Mínimo de flete** (USD).
- **Consolidador / Agente LCL**: selector desde `proveedores` filtrado por tipo agente/consolidador.
- **Días libres almacenaje LCL** (numérico, hoy sólo viene de tarifa).

### 3. Cálculo automático W/M en Mercancía
- Con las filas de `DimensionesLCL` calcular por fila `chargeable = max(peso_kg, volumen_m3 × 1000)` y sumar.
- Mostrar un KPI arriba de la tabla LCL: **Peso total / Volumen total / W/M facturable**.
- Ese W/M alimenta la venta: `venta_flete = max(W/M × tarifa_wm, minimo)`.

### 4. Validación del paso
En `usePaso1SectionStatus`:
- `tarifa: esMaritimo && !esLCL && !sinFleteVenta ? !!tarifaId : true`.
- Para LCL agregar validación de "flete listo": tarifa vinculada **o** (tarifa W/M > 0 y consolidador elegido).

## Cambios técnicos

- **Form (`types/form.ts`)**: añadir `lclFleteManual: { tarifaWM, minimo, diasLibresAlmacenaje, consolidadorId } | null`.
- **Hook `usePaso1SectionStatus.ts`**: nueva rama LCL para `tarifa` y helpers `fleteLCLOk`.
- **`SeccionMercanciaMaritimaLCL.tsx`**: KPI de W/M (utilidad pura `calcularWMLcl` con tests).
- **`TarifaFields.tsx` / `seccionRuta`**: renderizar bloque manual cuando `tipoEmbarque === "LCL" && !tarifaId`.
- **`buildCostosDesdeTarifa.ts`**: cuando no hay tarifa en LCL, construir concepto de flete desde captura manual (`max(WM × tarifaWM, minimo)`) apuntando al consolidador elegido como proveedor del costo.
- **Mappers `cotizacionForm.ts` / `cotizacion.ts`**: persistir campos nuevos en `cotizaciones` (columnas nuevas: `lcl_tarifa_wm`, `lcl_minimo_flete`, `lcl_dias_libres_almacenaje`, `lcl_consolidador_id`).
- **Migración**: agregar esas cuatro columnas nullable a `cotizaciones` (sin romper filas existentes).
- **Detalle de cotización** (`CotizacionDatosGeneralesCard`, `TarifaResumenHeredado*`): mostrar el flete manual cuando aplique.
- **Tests**: unitarios para `calcularWMLcl`, `fleteLCLOk`, y branches nuevos en `buildCostosDesdeTarifa`.
- **Changelog + bump `APP_VERSION`** a la siguiente minor (13.299.0).

## Fuera de alcance
- Migrar tarifas LCL existentes (siguen funcionando).
- Cambios en FCL, aéreo o terrestre.
- Facturación / proforma más allá del concepto de flete generado.

## Notas
- El consolidador se guarda como `proveedor_id` en el concepto de costo de flete, así el módulo de compras (CXP) y liquidación siguen funcionando sin cambios.
- El mínimo se aplica en centavos con `currency.js` respetando el estándar financiero del proyecto.

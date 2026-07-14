## Problema

En LCL, al pasar del paso 1 al paso 2, la fila auto-cargada de "Flete marítimo LCL" usa:

- `cantidad` = W/M facturable (ej. 0.894)
- `costo_unitario` = tarifa W/M (ej. 42)
- `precio_venta` = venta total / W/M

Eso genera dos problemas:

1. **Conceptualmente incorrecto**: el usuario está vendiendo **un solo flete marítimo**, no 0.894 unidades de algo. El desglose por W/M ya vive en el paso 1 (bloque "Flete LCL manual"); duplicarlo en el paso 2 confunde.
2. **Rompe el guardado**: el check constraint `cotizacion_costos_cantidad_pos` está rechazando la fila (probablemente exige `cantidad >= 1`, no sólo `> 0`), y valores como `0.894` la revientan.

## Cambio propuesto

Ajustar `buildCostosLCLManual.ts` para que la fila auto-cargada represente **un flete como línea única**:

- `cantidad` = `1`
- `unidad_medida` = `"Servicio"` (o `"Flete"`)
- `costo_unitario` = costo total del flete (`wm × tarifaWM`, redondeado a 2 decimales)
- `precio_venta` = venta total del flete (`max(wm × tarifaWM, minimo)`, redondeado a 2 decimales)
- `notas` conserva el detalle: `"Auto-cargado desde Flete LCL manual — W/M facturable X.XXX @ USD Y.YY [aplica mínimo USD Z.ZZ]"` para no perder la trazabilidad del cálculo.

Con esto:
- El usuario ve una sola línea "Flete marítimo LCL — 1 Servicio — USD 111.86" en el P&L, coherente con lo que está vendiendo.
- `cantidad = 1` pasa cualquier variante del check constraint.
- El detalle W/M sigue vivo en el paso 1 (donde se captura) y en `notas` (para auditoría).

## Alcance técnico

1. **`src/features/cotizacion/components/seccionRuta/buildCostosLCLManual.ts`**
   - Recalcular `costoTotal = round2(wm × tarifaWM)` y `ventaTotal = calcularFleteVentaLCL(...)` (ya existe).
   - Devolver fila con `cantidad: 1`, `unidad_medida: "Servicio"`, `costo_unitario: costoTotal`, `precio_venta: ventaTotal`.
   - Extender la nota con el W/M y la tarifa capturados.

2. **`src/features/cotizacion/components/seccionRuta/__tests__/buildCostosLCLManual.test.ts`**
   - Actualizar los 2 tests que hoy asertan `cantidad = wm` y `costo_unitario = tarifaWM` para el nuevo contrato (`cantidad = 1`, `costo_unitario = costoTotal`, `precio_venta = ventaTotal`).
   - Mantener los 3 tests de casos vacíos sin cambios.

3. **Changelog / versión**
   - `APP_VERSION` → `13.299.16`.
   - Entrada breve en `CHANGELOG.md`: "Fix: flete LCL manual se auto-carga como 1 línea de servicio (antes usaba W/M como cantidad y rompía el check constraint de `cotizacion_costos`)".

No hay cambios de BD, ni en el paso 1, ni en el resto del flujo de costos: sólo cambia la **forma** de la fila auto-precargada.

## Analogía

Es como cuando pides un Uber: la app calcula la tarifa según km y minutos, pero en tu recibo ves **"1 viaje — $180"**, no "12.4 km × $14.51". El desglose queda en el detalle, no en la línea de venta.

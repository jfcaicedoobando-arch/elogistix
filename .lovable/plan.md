## Cambio de negocio

Ampliar la bandeja **"Embarques sin factura"** (hueco de facturación) para incluir también embarques cuyo ETA cae en los **próximos 3 días**, no solo los ya vencidos. Así hay más buffer con los agentes aduanales.

**Criterio nuevo:** `ETA ≤ hoy + 3 días` (antes: `ETA ≤ hoy`).
Sigue respetando el corte `ETA ≥ 2026-04-01` y que el embarque no tenga CFDI asociado.

## Archivos a tocar

1. **`src/features/facturacion/services/huecoFacturacion/fetchSources.ts`**
   - Cambiar el filtro `.lte("eta", hoyIso)` para usar `hoy + 3 días`.
   - Ajustar el comentario del docblock.

2. **`src/features/facturacion/services/huecoFacturacion/index.ts`**
   - Pasar `hoy + 3 días` como límite superior al fetch.
   - Actualizar el comentario de reglas (`eta ≤ hoy` → `eta ≤ hoy + 3 días`).

3. **`src/features/facturacion/services/huecoFacturacion/buildFilas.ts`** (opcional/cosmético)
   - `diasDesdeEta` puede volverse negativo (ej. `-2` = "faltan 2 días"). La lógica ya lo soporta matemáticamente; solo revisamos que el sort desc siga teniendo sentido (los más vencidos arriba, futuros abajo → sí).

4. **`src/features/facturacion/components/bandejas/BandejaPorFacturar.tsx`**
   - Copy del encabezado: `"embarque(s) con ETA cumplida sin CFDI"` → `"embarque(s) sin CFDI (ETA vencida o dentro de 3 días)"`.
   - `emptyHint`: reflejar el nuevo criterio.

5. **`src/features/facturacion/components/huecoFacturacionColumns.tsx`** (verificar)
   - Si la columna "Días" muestra el valor crudo, un `-2` es legible pero confuso. Formatear como `"vence en 2 d"` cuando `diasDesdeEta < 0` y `"+N d"` cuando `≥ 0`. (Cambio de presentación, no de datos.)

6. **Tests**
   - `src/features/facturacion/services/__tests__/huecoFacturacion.test.ts`: agregar caso de embarque con ETA a +2 días que sí debe aparecer, y otro a +5 días que NO debe aparecer.
   - `src/features/facturacion/domain/__tests__/huecoCsv.extra.test.ts`: si un test asume `diasDesdeEta ≥ 0`, ajustar.

7. **Versionado / changelog**
   - Bump `APP_VERSION` en `src/constants/appVersion.ts` a `13.217.0` (cambio de reglas de negocio, minor).
   - Entrada en `CHANGELOG.md`: describir la ampliación del rango a 3 días.

## Analogía

Antes la bandeja era como un semáforo que se prendía solo cuando el barco ya había atracado. Ahora se prende también cuando ya está a la vista del puerto (3 días de anticipación), para que operaciones tenga margen de reacción con el agente aduanal.

## Notas técnicas

- El filtro `gte("eta", "2026-04-01")` se mantiene intacto — no revive back-fill.
- No hay cambios de base de datos ni RLS: es todo query + presentación.
- `diasDesdeEta` seguirá siendo `floor((hoy - eta)/día)`, por lo que embarques futuros darán valores negativos. El sort `desc` deja los más vencidos arriba, lo cual es la prioridad operativa correcta.

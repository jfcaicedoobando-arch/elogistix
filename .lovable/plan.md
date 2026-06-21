# Plan: Estado de conceptos en el tab Facturación

## Diagnóstico

**No es un bug de datos — es una etiqueta engañosa.**

Analogía: imagina que la columna "Estado" del concepto sólo tiene dos cajones — "Pendiente" y "En proforma". Cuando la proforma se factura, el concepto sigue dentro del cajón "En proforma" (porque nunca se creó un cajón "Facturado"). El cajón de "Facturado" vive un piso abajo, en la tabla de proformas.

Técnico:
- `conceptos_venta.estado_facturacion` es binario: `'pendiente'` | `'en_proforma'`. No existe `'facturado'`.
- El estado de facturación real vive en `proformas.estado_proforma` (`pendiente` / `facturada`).
- Cuando la proforma pasa a "Facturada", los conceptos vinculados (`proforma_id = <esa proforma>`) NO se actualizan — siguen mostrando el badge verde "En proforma".
- Por eso ves la tabla con todo "En proforma" y, abajo, el historial muestra la proforma como "Facturada". Es consistente con la BD, pero confuso visualmente.

## Cambios (UI únicamente, sin cambios de BD)

### 1. Derivar un tercer estado en presentación
En `TabFacturacion` calcular un `Map<conceptoId, 'pendiente'|'en_proforma'|'facturado'>` cruzando `conceptos` con `proformas`:
- `pendiente` → `estado_facturacion !== 'en_proforma'`
- `facturado` → tiene `proforma_id` y esa proforma tiene `estado_proforma === 'facturada'`
- `en_proforma` → tiene `proforma_id` pero la proforma aún `pendiente`

Pasar ese mapa a `ResumenConceptosVenta` y de ahí a `GrupoConceptosContenedor`.

### 2. Badge tri-estado en las tablas de conceptos
Reemplazar la celda actual (`ResumenConceptosVenta.tsx` línea 158-165 y `GrupoConceptosContenedor.tsx` línea 79) por un helper que devuelve:
- `Facturado` — badge `success` con ícono `Receipt`
- `En proforma` — badge `info` con `FileText` (ya no `success`, así no compite con el "Facturado")
- `Pendiente` — badge `neutral` con `Clock`

### 3. Totales en `ResumenConceptosVentaTotales`
Hoy muestra 2 columnas (Pendiente / En proforma). Cambiarlo a 3: Pendiente / En proforma / Facturado, calculando los montos respectivos en `ResumenConceptosVenta`.

### 4. Sin tocar lógica de generación de proformas
Los filtros `estado_facturacion !== 'en_proforma'` para "qué conceptos puedo meter en una proforma nueva" se mantienen — un concepto facturado tampoco debe reaparecer en el wizard de proforma (ya tiene `proforma_id`).

## No incluye

- No se modifica el schema ni se agrega un valor `'facturado'` a `conceptos_venta.estado_facturacion`. El estado canónico sigue viviendo en `proformas` (única fuente de verdad).
- No se tocan los datos existentes.
- No se cambia el flujo de generar / facturar proforma.

## Verificación

Con Playwright en `/embarques/7cbea742-…?tab=facturacion`:
1. Screenshot antes/después.
2. Confirmar que los conceptos cuya proforma está "Facturada" ahora muestran badge "Facturado" (verde con `Receipt`), y que los totales del card incluyen una tercera columna "Facturado" con el monto correcto.
3. Confirmar que un embarque con proforma aún pendiente sigue mostrando "En proforma" en azul.

## Changelog

- `appVersion.ts` → `13.90.5`
- `CHANGELOG.md` → entrada `[13.90.5] ui(embarque/facturacion) badge de conceptos refleja si la proforma ya fue facturada`.

## Archivos a editar

1. `src/features/embarques/components/TabFacturacion.tsx` — calcular y pasar el mapa de estados.
2. `src/features/embarques/components/facturacion/ResumenConceptosVenta.tsx` — recibir mapa + 3 totales.
3. `src/features/embarques/components/facturacion/GrupoConceptosContenedor.tsx` — recibir mapa, badge tri-estado.
4. `src/features/embarques/components/facturacion/ResumenConceptosVentaTotales.tsx` — tercera columna.
5. Nuevo helper `src/features/embarques/components/facturacion/estadoConceptoBadge.tsx` para no duplicar JSX del badge.
6. `appVersion.ts` + `CHANGELOG.md`.

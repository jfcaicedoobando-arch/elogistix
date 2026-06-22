## Hallazgo

El dashboard (`Arribos este mes → Gastos fijos cubiertos`) sigue calculando los **gastos operativos del mes** desde la columna **vieja** `proveedores.categoria = 'GastoOperativo'`. Como la categoría contable ya migró a las facturas (`proveedor_facturas.categoria_presupuesto_id`), ese filtro quedó huérfano: las facturas nuevas, donde el proveedor ya no tiene categoría asignada, **no se cuentan** en la barra y el porcentaje de cobertura sale más alto de lo real.

El resto de la app (vsReal, edición/captura de facturas, filtros CxP) ya usa `categoria_presupuesto_id`. El único punto pendiente de propagación es la RPC `public.dashboard_summary`, más una pieza faltante: hoy las categorías presupuestales no tienen forma de distinguir qué cuenta como "gasto fijo" (indirecto + administración) y qué no (COGS / comisiones variables).

## Cambio propuesto

### 1. Clasificación contable por categoría

Nuevo enum `public.tipo_contable_categoria` con tres valores:

- `CostoDirectoEmbarque` — COGS: flete, THC, BL, maniobras, almacenajes, demoras, custodia, agente. Va directo al costo del embarque, **no** entra a gastos fijos.
- `IndirectoOperacion` — sueldos operativos, sistemas, oficina operativa. **Sí** entra a gastos fijos.
- `Administracion` — renta, nómina admin, contador, papelería, marketing, etc. **Sí** entra a gastos fijos.

Se agrega columna `tipo_contable` (NOT NULL DEFAULT `'Administracion'`) en `public.presupuesto_categorias`. Backfill por nombre:

| Nombre actual | tipo_contable |
|---|---|
| Nómina | IndirectoOperacion |
| Renta, Servicios, Marketing, Otros, Sin categoría | Administracion |
| Comisiones | CostoDirectoEmbarque |

### 2. RPC `dashboard_summary`

Cambiar el CTE `gastos_op_facturas` para sumar `proveedor_facturas` cuyo `categoria_presupuesto_id` apunte a una categoría con `tipo_contable IN ('IndirectoOperacion','Administracion')`, en lugar de filtrar por `p.categoria='GastoOperativo'`. Mantener el sumando de `liquidaciones_comision` aparte (siguen siendo OpEx variable que el negocio quiere ver dentro de la cobertura de gastos fijos del mes).

### 3. UI Configuración de categorías

- `DialogCategoria.tsx`: agregar selector "Tipo contable" (3 opciones con descripción corta debajo).
- `TabCategorias.tsx`: nueva columna "Tipo contable" en la tabla con etiqueta legible.
- `services/categorias.ts`: el tipo `CategoriaPresupuesto` ya viene de DB types, no requiere cambio manual; sólo asegurar que `crearCategoria`/`actualizarCategoria` acepten `tipo_contable`.

### 4. Tooltip del dashboard

En `ArribosCardTooltips.tsx`, ajustar el texto de "Cobertura de gastos fijos" para aclarar que incluye **gastos indirectos de operación + gastos de administración + comisiones del mes** (excluye COGS).

### 5. Versionado

- `APP_VERSION` → `13.112.0` (cambia BD y semántica del dashboard).
- Entrada en `CHANGELOG.md` explicando el fix con analogía.

## Fuera de alcance

- No se borra `proveedores.categoria` ni el enum `categoria_proveedor` (datos históricos intactos).
- No se cambia la UI del directorio de proveedores (ya migrada en 13.111.x).
- No se altera el módulo de Presupuesto vs Real (ya usa `categoria_presupuesto_id`).
- No se exponen reportes nuevos por bucket; sólo se corrige el cálculo del progress bar.

## Riesgos

- Categorías custom creadas por usuarios quedarán por defecto en `Administracion` (lo más conservador, entra a gastos fijos). El usuario puede reclasificarlas desde Configuración.
- Si una factura no tiene `categoria_presupuesto_id` (no debería pasar tras `13.111.0` que lo hizo NOT NULL), no se cuenta. Está bien.
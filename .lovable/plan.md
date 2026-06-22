## Diagnóstico

Tu app ya tiene **dos lugares** para esta pregunta — sólo uno te da la vista exacta que pides:

### Opción A — Ya existe y resuelve tu pregunta sin cambios

`/profit/presupuesto` → pestaña **"Vs Real"**

- Selector de **Periodo (mes)** arriba.
- KPIs: Total presupuesto / Total real / Variación.
- Tabla por **categoría de presupuesto** (Renta, Nómina, Servicios, etc.) con presupuesto, real, variación y % cumplimiento.
- Botón **PDF** para exportar.

Pon "junio 2026" en el selector y tienes el gasto operativo total y desglosado.

### Opción B — Falta una mejora chica

En `/compras` → **CxP** hoy puedes filtrar por proveedor, moneda, estatus, origen, aprobación y fechas de emisión, **pero no por categoría de presupuesto**. Eso te impide aislar sólo "gastos administrativos" (Renta, Nómina, etc.) desde esa lista para exportarlos a Excel.

## Plan (cambios mínimos)

### 1. Agregar filtro "Categoría de presupuesto" a CxP

`**src/features/cxp/services/proveedorFacturas.ts**`

- Sumar `categoria_presupuesto_id?: string` a `FetchCxPFiltros`.
- Incluir `categoria_presupuesto_id` en el `select` (ya existe en la columna).
- Si `filtros.categoria_presupuesto_id && !== "todas"` → `q = q.eq("categoria_presupuesto_id", ...)`.

`**src/features/cxp/services/proveedorFacturas.helpers.ts**`

- Agregar `categoria_presupuesto_id` al tipo `Joined` y al return de `mapJoinedRow`.

`**FacturaCxP**` (interface): nueva propiedad opcional `categoria_presupuesto_id: string | null`.

**Componente de filtros de CxP** (la barra de filtros de la lista): agregar un `<Select>` "Categoría" alimentado por `usePresupuestoCategorias()` con opción default "Todas las categorías".

### 2. Atajo de "Sólo gastos administrativos" en `/compras`

En el header de CxP, un botón chip que aplique en un click: `categoria_presupuesto_id ∈ (todas las categorías marcadas como administrativas)`. Por ahora, como no hay flag "tipo" en `presupuesto_categorias`, lo dejamos como filtro manual por categoría (un select). Si más adelante quieres, agregamos un campo `tipo: 'operativo' | 'embarque'` a la tabla.

### 3. Versionado

- `APP_VERSION` → `13.106.8`
- `CHANGELOG.md`: "feat(cxp): filtro por categoría de presupuesto en la lista de facturas de proveedor para aislar gastos administrativos".

## Lo que NO cambia

- Esquema de BD (la columna ya existe).
- RLS, GRANTs.
- Lógica de aprobación, pagos, vínculos con embarques.
- El módulo `/profit/presupuesto` (ya funciona).

## Analogía

Es como tu chequera: la pestaña "Vs Real" es el **resumen mensual** del banco (totales por concepto); CxP es el **fólder de facturas**. Hoy puedes ver el resumen, pero al abrir el fólder no puedes pedir "muéstrame sólo las de renta y nómina" — eso es lo que arregla el filtro nuevo.

## Recomendación

Si **sólo quieres el número de junio ahora mismo**, ve a `/profit/presupuesto` → "Vs Real" → selecciona "Junio 2026" → exporta PDF. Cero código.

Si quieres además poder **exportar la lista cruda de facturas administrativas** desde CxP, aprueba este plan y hago los 4 cambios. Hagamos los cambios.
## Objetivo

Un mismo proveedor puede emitir facturas para distintos tipos de gasto (COGS, indirectos, OpEx). Por eso la **categoría contable se decide a nivel de cada factura**, no del proveedor.

## Cambios

### 1. Proveedor — quitar categoría/subtipo del UI (datos en BD se conservan)

- `ProveedorTable.tsx`: quitar columna "Categoría / Subtipo".
- `ProveedoresFiltros.tsx` y filtros relacionados (`useProveedores`, hooks de filtro): quitar el filtro por categoría/subtipo.
- Alta/edición de proveedor (`useNuevoProveedorController.*`, `useEditarProveedorController.ts`, formulario): retirar los selects de Categoría y Subtipo de gasto. Al guardar, dejar `categoria` y `subtipo_gasto` como `null` para nuevos registros.
- Migración: `ALTER TABLE public.proveedores ALTER COLUMN categoria DROP NOT NULL;` (subtipo ya es nullable). No se borran datos.

### 2. Factura de proveedor — categoría contable **obligatoria**

- `FacturaProveedorFormFields.tsx`: marcar el select de Categoría como requerido (asterisco + `aria-required`) y subir su prioridad visual (junto a Proveedor / Folio).
- `useNuevaFacturaProveedorForm.helpers.ts` y `useEditarFacturaProveedorForm.ts`: agregar validación Zod `categoria_presupuesto_id: z.string().uuid({ message: "Selecciona una categoría contable" })`. Bloquea submit en alta y edición.
- Migración: `ALTER TABLE public.proveedor_facturas ALTER COLUMN categoria_presupuesto_id SET NOT NULL;` precedido de un backfill defensivo a la categoría "Sin categoría" (creada por organización si no existe) para evitar romper datos legados.

### 3. CxP — filtro por categoría contable

- `CxpFiltros.tsx` / `CxpFiltrosSheetFields.tsx`: nuevo select con la lista de `presupuesto_categorias` de la organización + opción "Todas".
- `useCxpPageState.ts` / `useFacturasCxP.ts` / `proveedorFacturas.helpers.ts`: agregar `categoriaId?: string` a `FetchCxPFiltros` y aplicar `eq('categoria_presupuesto_id', ...)` en la query del servicio.
- `InfoFacturaSection.tsx` ya muestra la categoría; sin cambios.

### 4. Constantes / limpieza

- `proveedorConstants.ts`: las constantes `CATEGORIAS_PROVEEDOR` y `SUBTIPOS_GASTO_OPERATIVO` quedan referenciadas sólo desde lugares que se eliminan. Mantener el archivo pero marcar export como `@deprecated` para no romper imports residuales detectados por `knip`.

### 5. Versionado y changelog

- `src/constants/appVersion.ts` → `13.111.0`.
- `CHANGELOG.md` entrada `[13.111.0] - 2026-06-22`:
  - Cambio: la categoría contable ya no se asigna al proveedor; se elige en cada factura (obligatoria).
  - Mejora: filtro por categoría contable en CxP.
  - BD: `proveedores.categoria` ahora nullable; `proveedor_facturas.categoria_presupuesto_id` ahora NOT NULL (con backfill).

## Fuera de alcance

- No se tocan permisos/RLS ni el flujo de aprobación.
- No se modifican pagos, notas de crédito, ni historial.
- No se borra ningún dato existente de proveedores.

## Objetivo

En el modal de captura de factura de proveedor, el dropdown "Categoría contable" debe mostrar únicamente 3 opciones fijas:

1. Costos directos de embarque (COGS)
2. Gastos de administración
3. Gastos de venta

Eliminamos la dependencia de la tabla `presupuesto_categorias` en este modal y guardamos el tipo contable directamente en la factura.

## Cambios

### 1. Base de datos (migración)

- Renombrar valor del enum `tipo_contable_categoria`: `IndirectoOperacion` → `Venta` (Postgres `ALTER TYPE ... RENAME VALUE`).
- Agregar columna `tipo_contable` (enum `tipo_contable_categoria`) a `proveedor_facturas`.
- Backfill: copiar `tipo_contable` desde `presupuesto_categorias` para las 12 facturas con `categoria_presupuesto_id`.
- Mantener `categoria_presupuesto_id` por compatibilidad (no se elimina; queda como referencia histórica opcional).
- Reasignar filas existentes de `presupuesto_categorias` con tipo `IndirectoOperacion` (3 filas) — el rename del enum las migra automáticamente a `Venta`.

### 2. Frontend — modal de captura

Archivos a tocar:

- `src/features/cxp/components/FacturaProveedorFormFields.tsx` — reemplazar el `Select` que itera `categorias` por uno con las 3 opciones fijas tomadas del enum.
- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers.ts` — cambiar `categoriaId: string` por `tipoContable: TipoContable | ""` en `FacturaFormValues`, `initialValues`, `validateFactura` y `buildPayload`.
- `src/features/cxp/components/facturaFormPrimitives.tsx` — actualizar la interfaz `FacturaFormValues`.
- `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx` y `DialogEditarFacturaProveedor.tsx` — quitar `usePresupuestoCategorias` y el prop `categorias`.
- `src/features/cxp/services/*` (parseCfdi y servicios de creación/edición de factura) — mapear a `tipo_contable` en lugar de `categoria_presupuesto_id` al enviar a Supabase; ajustar sugerencia de IA del CFDI para devolver `tipo_contable`.
- `src/features/cxp/components/InfoFacturaSection.tsx` — mostrar el label del tipo contable.
- `supabase/functions/parse-cfdi-xml/index.ts` + `aiHelpers.ts` — el AI Gateway debe sugerir `tipo_contable` (uno de los 3 valores) en lugar de `categoria_id`. Actualizar el tool-call schema y los tests `aiHelpers_test.ts`.

### 3. Etiquetas (español MX)

Mapa único centralizado:

```ts
const TIPO_CONTABLE_LABEL = {
  CostoDirectoEmbarque: "Costos directos de embarque (COGS)",
  Administracion: "Gastos de administración",
  Venta: "Gastos de venta",
};
```

Se aplica en el dropdown, en `InfoFacturaSection`, y en `DialogCategoria.tsx` (módulo de presupuesto) para que las etiquetas queden consistentes.

### 4. Versionado y changelog

- Bump `APP_VERSION` → `13.114.6`.
- Entrada en `CHANGELOG.md` describiendo el rediseño del dropdown y el rename `IndirectoOperacion → Venta`.

### 5. Verificación

- `bunx vitest run` (suite completa).
- `bunx vitest run supabase/functions/parse-cfdi-xml/aiHelpers_test.ts` para confirmar el nuevo contrato.
- Smoke en el preview: abrir `/cxp` → "Nueva factura" → confirmar que el dropdown muestra exactamente las 3 opciones.

## Detalles técnicos

- El rename del enum es seguro: Postgres actualiza todas las referencias existentes en una sola operación.
- `categoria_presupuesto_id` no se borra ahora para no perder histórico; en una siguiente fase se puede deprecar si el módulo de presupuesto deja de usarlo.
- Power-of-10: todos los archivos tocados se mantienen ≤200 líneas; el mapa de labels va en `src/features/cxp/constants/tipoContable.ts` (nuevo, ~10 líneas) para evitar duplicación.

## Analogía

Hoy el modal te pide elegir entre una lista larga de "subcategorías" que un admin tuvo que crear antes. Lo nuevo es como cambiar un menú de restaurante con 50 platillos por uno con 3 combos fijos: el cliente elige rápido y sin confusión.

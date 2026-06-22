## Objetivo

Alinear las etiquetas visibles de la app con la terminología contable estándar de una agencia forwarder:

- **Costos directos del embarque** = COGS (flete, maniobras, almacenajes, agente). Hoy aparece como "Costos" / "Conceptos de Costo" / "Liquidación de gastos".
- **Gastos de administración** = OpEx (renta, nómina admin, papelería). Hoy aparece como "Gastos operativos".

Es **sólo cambio de copy/etiquetas en UI**. No se tocan tipos, enums de BD, columnas, ni lógica de negocio.

## Cambios por archivo

### 1. Arreglar la Ayuda
**`src/features/dashboard/routes/ayudaContent.ts`** (líneas 58, 63)
- "Proformas, facturas y **liquidación de gastos**." → "...y **liquidación de costos**."
- "¿Qué hago con la pestaña **Liquidación de gastos**?" → "...pestaña **Liquidación de costos**?"

### 2. Reforzar "Costos directos del embarque" en el wizard y tarjetas
**`src/features/embarques/components/StepCostosPreciosCards.tsx`** (línea 34)
- `<CardTitle>Conceptos de Costo</CardTitle>` → `Costos directos del embarque`

**`src/features/embarques/components/costos/ConceptosCostoCard.tsx`** (líneas 35, 40, 45)
- Empty title: `"Sin conceptos de costo"` → `"Sin costos directos del embarque"`
- Empty description: `"Aún no se han registrado conceptos de costo..."` → `"Aún no se han registrado costos directos..."`
- `<CardTitle>Conceptos de Costo</CardTitle>` → `Costos directos del embarque`

**`src/features/embarques/components/TabConciliacion.tsx`** (línea 154)
- "Carga conceptos de costo y vincúlalos..." → "Carga **costos directos** y vincúlalos..."

(No tocar nombres de variables, tipos, ni columnas; sólo strings JSX/atributos `description`/`header`.)

### 3. OpEx → "Gastos de administración"
**`src/features/proveedor/routes/Proveedores.tsx`**
- Línea 25: `{ value: "GastoOperativo", label: "Gastos operativos" }` → `label: "Gastos de administración"`
- Línea 69: `description="Directorio de proveedores logísticos y de gastos operativos"` → `"...y de gastos de administración"`

**`src/features/proveedor/components/proveedorTableColumns.tsx`** (líneas 27, 29)
- Badge "Gasto operativo" → "Gasto de administración"
- Fallback `labelSubtipoGasto(p.subtipo_gasto) ?? "Gasto operativo"` → `"Gasto de administración"`

**`src/features/proveedor/routes/ProveedorDetalle.tsx`** (línea 73)
- Fallback `"Gasto operativo"` → `"Gasto de administración"`

**`src/features/dashboard/components/statusCards/ArribosCardTooltips.tsx`** (líneas 114, 119)
- `"Gastos operativos del mes"` → `"Gastos de administración del mes"`
- `"Aún no hay gastos operativos capturados este mes."` → `"...gastos de administración..."`

**No se tocan** (son nombres técnicos internos, no UI):
- enum BD `subtipo_gasto_operativo`, valor `"GastoOperativo"` en `categoria`
- variables/tipos `SubtipoGasto`, `subtipo_gasto`, `gastosOperativosMXN`
- columnas Supabase, RPCs, parsers
- Importador CSV (los usuarios técnicos siguen usando `GastoOperativo` como categoría)

### 4. Versionado y changelog
- `src/constants/appVersion.ts`: `13.106.8` → `13.106.9`
- `CHANGELOG.md`: nueva entrada `## [13.106.9] - 2026-06-22` con bullet "Renombrado contable de etiquetas: 'Conceptos de Costo' → 'Costos directos del embarque'; 'Gastos operativos' → 'Gastos de administración'; 'Liquidación de gastos' → 'Liquidación de costos'."

## Verificación

- `bunx vitest run` sobre `architecture.test.ts` y los snapshots de los componentes tocados (si existen) — no debería romper nada porque sólo cambian strings.
- Smoke visual: abrir `/proveedores` (tab "Gastos de administración"), `/cxp`, wizard de embarque paso de costos, dashboard tarjeta Arribos, Ayuda → módulo CxP.

## Analogía 📊

Hoy la app dice "gastos" en sitios donde el contador esperaría "costo" (lo del embarque, que va **arriba** de la utilidad bruta) y dice "gastos operativos" donde el contador esperaría "gastos de administración" (renta/nómina, que va **abajo**). Sólo cambiamos los letreros, no los cajones.

# Auditoría P2 y cierre de fase

## 1) Auditoría de lo construido en el turno anterior

### Verde ✅
- **Migración** `cotizacion_plantillas`: RLS multi-tenant correcta (autor + `visibilidad='org'` + roles `admin/admin_org/gerente_comercial`), RPC `aplicar_plantilla_cotizacion` atómica con incremento `veces_usada`, GRANTs y trigger `updated_at` presentes.
- **Hooks** (`useCotizacionPlantillas.ts`): `queryOptions`, `staleTime`, invalidación explícita, orden por `veces_usada desc, updated_at desc`, tipado limpio. 6/6 tests verdes.
- **Integraciones**: `CotizacionSuccessDialog` (botón "Guardar como plantilla") y `NuevaCotizacion.tsx` (banner en Paso 1) cableadas correctamente. `form.reset({...current, ...values}, { keepDefaultValues: true }) + trigger()` cumple la regla RHF del core.

### Rojo/Ámbar 🟡
1. **Tests faltantes** para dos componentes nuevos:
   - `GuardarPlantillaDialog` — validación `nombre ≥ 3`, limpieza de folios/fechas en `limpiarValues`, cierre + reset al guardar OK, toast de error.
   - `PlantillaSelectorPaso1` — no renderiza si `organizationId=null` o lista vacía, aplica con `form.reset+trigger`, dispara `onApplied`, muestra badge `Nx` vs `Nueva`.
2. **Cumplimiento `FormDialogShell`** (regla core "Modales tipo formulario…"): `GuardarPlantillaDialog` usa `Dialog` plano. Migrar a `FormDialogShell` + `FormDialogSection` para alinearse al estándar del proyecto.
3. **Tipado**: `limpiarValues` usa `any`. Reemplazar por un `Omit<Partial<CotizacionFormValues>, 'id'|'folio'|...>` con destructuring tipado (Power of 10: prohibido `any` implícito).

### Acciones de la auditoría (correcciones + tests)
- Migrar `GuardarPlantillaDialog` a `FormDialogShell` + `FormDialogSection` (icon-tile, secciones, footer sticky).
- Tipar `limpiarValues` sin `any`.
- Crear `GuardarPlantillaDialog.test.tsx` (≥4 casos) y `PlantillaSelectorPaso1.test.tsx` (≥4 casos).

## 2) Cierre de Fase P2 — pendientes anunciados

### 2A. Página `/cotizaciones/plantillas` (gestión)
- **Ruta**: `src/routes/cotizaciones/plantillas.tsx` (lazy) registrada en el router de cotizaciones + entrada en menú "Cotizaciones → Plantillas".
- **UI**: `DataTable` estándar con columnas *Nombre · Descripción · Visibilidad · Usos · Última actualización · Autor · Acciones* (menu con `e.stopPropagation()` en la fila).
- **Acciones**:
  - **Editar metadatos** (nombre / descripción / visibilidad) → nuevo hook `useActualizarPlantilla` (update directo, RLS ya lo protege) con optimistic update via `useMutationWithFeedback`.
  - **Eliminar** con doble confirmación tipable "ELIMINAR" (regla data-safety) → reusa `useEliminarPlantilla` existente.
  - **Duplicar** (opcional pequeño): copia payload con nombre "… (copia)".
- **Filtros**: por visibilidad (yo/org) y búsqueda por nombre. Server-side vía `.ilike` + `.range()` (paginación estándar del proyecto).
- **Empty state**: CTA "Guarda tu primera plantilla desde el wizard".
- **Tests**: 1 test de integración del listado + 1 por acción (editar / eliminar).

### 2B. Unificar "Agregar concepto" en pasos 2/3
Estado actual: `SeccionConceptosVentaCotizacion` tiene **dos botones separados** ("Agregar" USD y "Agregar" MXN) → fricción reportada en la auditoría inicial del wizard.

- **Nuevo componente** `AgregarConceptoInline.tsx`: un solo botón "Agregar concepto" que abre un `Popover` con:
  - `ProductoServicioSelect` (catálogo SAT) — reutiliza el existente.
  - Toggle **Moneda: USD / MXN** (segmented) — determina en qué tabla se inserta.
  - Descripción libre opcional, unidad (`UnidadMedidaSelect`) y cantidad prefill 1.
  - Botón "Agregar" → llama a `agregarConceptoUSD` o `agregarConceptoMXN` inyectando `clave_sat` + `descripcion` + `unidad`.
- **Reutilización paso 2/3**: el mismo componente se monta tanto en `SeccionConceptosVentaCotizacion` (paso 3 — venta) como en `SeccionCostosInternosPLLocal` / `SeccionCostosInternosPLUnificado` (paso 2 — costos). Se pasa un prop `variante: "venta" | "costo"` que ajusta el label del toggle y los callbacks.
- **Compatibilidad**: se mantienen `agregarConceptoUSD` / `agregarConceptoMXN` — el nuevo componente sólo los orquesta. Sin cambios en el store del wizard.
- **Tests**: 3 casos — abre popover, selecciona SAT+USD y llama al callback correcto, valida cantidad > 0.

## 3) Versionado y changelog
- Bump `APP_VERSION` → `13.296.0`.
- Entrada `CHANGELOG.md`: "P2 cierre — Gestión de plantillas + Agregar concepto unificado".

## 4) Verificación final
- `bun run tsgo` (typecheck).
- `bunx vitest run` sobre los archivos nuevos/tocados (hooks + 5 componentes).
- Recorrido manual Playwright: crear plantilla desde success dialog → verla en `/cotizaciones/plantillas` → aplicarla en nuevo wizard → agregar concepto USD con `AgregarConceptoInline`.

## Detalles técnicos

```text
src/
├── features/cotizacion/
│   ├── hooks/
│   │   ├── useCotizacionPlantillas.ts        (+useActualizarPlantilla)
│   │   └── __tests__/useCotizacionPlantillas.test.tsx  (+update tests)
│   └── components/
│       ├── wizard/
│       │   ├── GuardarPlantillaDialog.tsx     (→ FormDialogShell, sin any)
│       │   ├── PlantillaSelectorPaso1.tsx     (sin cambios funcionales)
│       │   ├── AgregarConceptoInline.tsx      (NUEVO)
│       │   └── __tests__/
│       │       ├── GuardarPlantillaDialog.test.tsx    (NUEVO)
│       │       ├── PlantillaSelectorPaso1.test.tsx    (NUEVO)
│       │       └── AgregarConceptoInline.test.tsx     (NUEVO)
│       └── SeccionConceptosVentaCotizacion.tsx  (usa AgregarConceptoInline)
├── routes/cotizaciones/
│   └── plantillas.tsx                         (NUEVO — página gestión)
└── constants/appVersion.ts                    (13.296.0)
```

Sin cambios de BD adicionales (la tabla y RPC ya existen). `useActualizarPlantilla` es un `UPDATE` directo con `.eq('id', ...)` — la RLS de update ya está limitada a autor/admin en la migración previa.

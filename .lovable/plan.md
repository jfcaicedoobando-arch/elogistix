

## Plan de Refactorización por Fases — v3.13.0

### Hallazgos del Análisis

---

### 1. Codigo Duplicado

| Duplicación | Archivos | Descripción |
|---|---|---|
| `ConceptoVentaLocal` / `ConceptoCostoLocal` interfaces + CRUD helpers | `NuevoEmbarque.tsx`, `EditarEmbarque.tsx`, `StepCostosPrecios.tsx` | Mismas interfaces y funciones `update/add/remove` repetidas 3 veces |
| `getEstadoCotizacionColor()` | `Cotizaciones.tsx` | Duplica lo que ya hace `getEstadoColor()` en `helpers.ts` (solo falta agregar los estados de cotización al mapa existente) |
| `estadoColor` objeto | `CotizacionDetalle.tsx` | Mismo caso: mapa de colores duplicado vs `getEstadoColor()` |
| `resolveShipper` / `resolveConsignatario` | `NuevoEmbarque.tsx` | Funciones casi idénticas que podrían ser una sola función parametrizada |
| Lógica de paginación | `Embarques.tsx`, `Cotizaciones.tsx` | Patrón idéntico de `page`, `PAGE_SIZE`, `paginated`, `totalPages` y botones Anterior/Siguiente |
| Patrón de barra de búsqueda con icono | `Embarques.tsx`, `Cotizaciones.tsx`, `Clientes.tsx`, `Proveedores.tsx`, `Facturacion.tsx` | Exactamente el mismo JSX con `Search` icon + `Input` |

### 2. Archivos Demasiado Largos / Complejos

| Archivo | Líneas | Problema |
|---|---|---|
| `NuevaCotizacion.tsx` | 547 | ~50 estados individuales con `useState`, sección Ruta inline (~100 líneas), sección Conceptos de Venta inline (~40 líneas), `handleGuardar` con ~40 líneas de mapping |
| `CotizacionDetalle.tsx` | 459 | Secciones de datos generales, mercancía, dimensiones, conceptos y dialog de conversión todo en un solo archivo |
| `EditarEmbarque.tsx` | 374 | Replica toda la lógica de `NuevoEmbarque.tsx` con adiciones para pre-llenado |

### 3. Uso Excesivo de `as any`

| Archivo | Instancias | Motivo |
|---|---|---|
| `CotizacionDetalle.tsx` | ~20 | `CotizacionRow` no incluye todos los campos que se acceden (`tiempo_transito_dias`, `frecuencia`, `ruta_texto`, etc.) |
| `useCotizaciones.ts` | ~8 | Casts a `any` en inserts para evadir tipos de Supabase |

### 4. Variables / Funciones Sin Usar o Renombrables

- `NuevoEmbarque.tsx`: `isStep1Valid` / `isStep2Valid` devuelven `true` siempre (temporal, pero el toast check en `onClick` sigue referenciándolas — código muerto)
- `EditarEmbarque.tsx`: variable `totalSteps` declarada pero podría ser constante del módulo
- `Cotizaciones.tsx`: variable iteradora `cot` (abreviada), `v` y `e` como parámetros de callbacks — deberían ser descriptivos
- `NuevaCotizacion.tsx`: `actualizarConcepto` usa `(copia[index] as any)[campo]` — acceso no tipado

---

### Fases de Implementación

#### Fase 1 — Consolidar utilidades duplicadas
- Agregar estados de cotización (`Borrador`, `Enviada`, `Aceptada`, `Confirmada`, `Rechazada`, `Vencida`) al mapa de `getEstadoColor()` en `helpers.ts`
- Eliminar `getEstadoCotizacionColor()` de `Cotizaciones.tsx` y `estadoColor` de `CotizacionDetalle.tsx`, reemplazando por `getEstadoColor()`
- Extraer `ConceptoVentaLocal`, `ConceptoCostoLocal` e interfaces a un archivo compartido `src/data/conceptoTypes.ts`
- Crear hook `useConceptosForm()` que encapsule el state + CRUD (`update`, `add`, `remove`, `subtotal`, `nextId`) para venta y costo, usado por `NuevoEmbarque` y `EditarEmbarque`

#### Fase 2 — Dividir archivos grandes
- **`NuevaCotizacion.tsx`**: Extraer sección "Ruta" a `src/components/cotizacion/SeccionRuta.tsx`, sección "Conceptos de Venta" a `src/components/cotizacion/SeccionConceptosVenta.tsx`, y sección "Destinatario" a `src/components/cotizacion/SeccionDestinatario.tsx`
- **`CotizacionDetalle.tsx`**: Extraer "Datos Generales + Ruta" a `src/components/cotizacion/DetalleDatosGenerales.tsx`, "Mercancía + Dimensiones" a `src/components/cotizacion/DetalleMercancia.tsx`, y "Dialog Convertir Prospecto" a `src/components/cotizacion/DialogConvertirProspecto.tsx`
- **`EditarEmbarque.tsx`**: Unificar la lógica duplicada con `NuevoEmbarque` extrayendo el estado del formulario a un hook `useEmbarqueForm()` que soporte modo "crear" y "editar"

#### Fase 3 — Eliminar `as any` y código muerto
- Completar `CotizacionRow` en `useCotizaciones.ts` con todos los campos que ya existen pero se acceden via `as any` (los campos ya están declarados en la interfaz, pero el código en `CotizacionDetalle` no los usa directamente)
- Eliminar todos los `(cotizacion as any).campo` en `CotizacionDetalle.tsx` usando la interfaz ya correcta
- Eliminar el código muerto del toast validation check que referencia `isStep1Valid`/`isStep2Valid` en `NuevoEmbarque.tsx` (ya retornan `true`)
- Renombrar variables abreviadas: `cot` → `cotizacion`, `v` → `valorSeleccionado`, `e` → `estadoSeleccionado`, `c` → `cliente`, `p` → `proveedor` en `Cotizaciones.tsx`

#### Fase 4 — Extraer componentes reutilizables
- Crear `src/components/SearchInput.tsx` (barra de búsqueda con icono) reutilizable en las 5 páginas de listado
- Crear `src/components/PaginationControls.tsx` para el patrón Anterior/Siguiente compartido entre `Embarques.tsx` y `Cotizaciones.tsx`
- Unificar `resolveShipper` y `resolveConsignatario` en una sola función `resolverContacto(contactos, valor, valorManual)` en `helpers.ts`

#### Fase 5 — Changelog
- Agregar entrada v3.13.0 documentando toda la refactorización

### Archivos a crear
- `src/data/conceptoTypes.ts`
- `src/hooks/useConceptosForm.ts`
- `src/components/cotizacion/SeccionRuta.tsx`
- `src/components/cotizacion/SeccionConceptosVenta.tsx`
- `src/components/cotizacion/SeccionDestinatario.tsx`
- `src/components/cotizacion/DetalleDatosGenerales.tsx`
- `src/components/cotizacion/DetalleMercancia.tsx`
- `src/components/cotizacion/DialogConvertirProspecto.tsx`
- `src/components/SearchInput.tsx`
- `src/components/PaginationControls.tsx`

### Archivos a modificar
- `src/lib/helpers.ts`
- `src/hooks/useCotizaciones.ts`
- `src/pages/NuevaCotizacion.tsx`
- `src/pages/CotizacionDetalle.tsx`
- `src/pages/NuevoEmbarque.tsx`
- `src/pages/EditarEmbarque.tsx`
- `src/pages/Embarques.tsx`
- `src/pages/Cotizaciones.tsx`
- `src/pages/Clientes.tsx`
- `src/pages/Proveedores.tsx`
- `src/pages/Facturacion.tsx`
- `src/pages/Changelog.tsx`


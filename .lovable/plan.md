

# Auditoría de Arquitectura del Codebase

## Veredicto General

La arquitectura es **sólida en su mayoría**: barrel exports, query key factory, hooks modulares, separación de tipos, y lazy loading por rutas. Sin embargo, hay oportunidades concretas de mejora.

---

## Hallazgos ordenados por criticidad

### 1. ALTO -- `shortName()` duplicada en dos archivos
- `Embarques.tsx` (L38) y `ClienteDetalle.tsx` (L106) tienen la misma función `shortName()` definida inline.
- **Acción**: Mover a `src/lib/formatters.ts` y reutilizar.

### 2. ALTO -- `CotizacionDetalle.tsx` es un componente monolítico (335 líneas)
- Mezcla lógica de parsing de conceptos, cálculo de totales, manejo de estado de diálogos, acciones de negocio y renderizado.
- **Acción**: Extraer un hook `useCotizacionDetalleState()` (similar al patrón ya usado en `useAdminOrgDetalle`) y sub-componentes para las secciones de acciones y datos generales.

### 3. ALTO -- `ClienteDetalle.tsx` (304 líneas) con definición inline de column configs
- Define `embarqueColumns` y `cotizacionColumns` dentro del componente, recreándolos en cada render.
- **Acción**: Extraer las columnas como constantes fuera del componente (o en un archivo separado bajo `src/components/cliente/`), y extraer un hook `useClienteDetalleState()`.

### 4. MEDIO -- `Embarques.tsx` (357 líneas) acumula demasiada lógica
- Manejo de filtros, columnas, exportación CSV, y diálogos de eliminación/duplicación, todo en un archivo.
- **Acción**: Extraer la configuración de columnas a `src/components/embarque/embarqueColumns.tsx` y un hook `useEmbarquesListState()` para los filtros y acciones.

### 5. MEDIO -- `profitUtils.tsx` contiene JSX en `src/lib/`
- Archivos en `src/lib/` deberían ser utilidades puras. `ProfitBadge` y `RentabilidadGlobalBadge` son componentes React.
- **Acción**: Mover los componentes a `src/components/shared/ProfitBadge.tsx`, dejar solo las funciones puras (`calcularTotalesPL`) en `src/lib/profitUtils.ts`.

### 6. MEDIO -- `helpers.ts` mezcla formateo con lógica de UI (colores)
- `getEstadoColor()` y `getModoIcon()` son mapeos de UI, no helpers genéricos. `resolverContacto()` es lógica de dominio.
- **Acción**: Mover `getEstadoColor` y `getModoIcon` a un archivo `src/lib/estadoConfig.ts` o `src/lib/uiMappings.ts` dedicado.

### 7. MEDIO -- `EmbarqueDetalle.tsx` tiene handlers de documentos inline
- `handleUpload`, `handleDeleteDoc`, `handleDownload`, `handleAvanzarEstado`, `getSiguienteEstado` son ~65 líneas de lógica dentro del componente.
- **Acción**: Extraer a un hook `useEmbarqueDetalleActions(embarque, id)`.

### 8. BAJO -- Componentes sueltos en `src/components/` raíz
- `EditarProveedorDialog.tsx`, `NuevoProveedorDialog.tsx`, `NuevoUsuarioDialog.tsx` están en la raíz de components en vez de carpetas por dominio.
- **Acción**: Mover a `src/components/proveedor/` y `src/components/usuario/` respectivamente.

### 9. BAJO -- `DocumentoProveedor` legacy en `src/data/types.ts`
- El comentario dice "Legacy interface kept for NuevoProveedorDialog". Si ya no se usa, eliminar.
- **Acción**: Verificar si aún se referencia; si no, eliminar.

### 10. BAJO -- `estadoConfig.ts` ya existe en `src/components/dashboard/`
- Hay un `estadoConfig.ts` en dashboard que podría consolidarse con `getEstadoColor`/`getModoIcon` de helpers.
- **Acción**: Evaluar si se pueden unificar en un solo lugar.

### 11. OPCIONAL -- `useCotizacionWizardForm.ts` (429 líneas)
- Es largo pero bien estructurado internamente con sub-hooks extraídos (`useConceptosVentaCotizacion`, `useCotizacionPL`). La complejidad es inherente al wizard de 4 pasos.
- **No requiere acción inmediata**, pero se podría considerar separar `handleSiguiente` en funciones por paso.

### 12. OPCIONAL -- Tipos locales repetidos
- `ClienteDetalle.tsx` define `type EmbarqueCliente` y `type CotizacionCliente` inline. Podrían exportarse desde los hooks correspondientes.

---

## Resumen de Acciones (orden sugerido de ejecución)

| # | Prioridad | Acción | Archivos afectados |
|---|-----------|--------|-------------------|
| 1 | Alta | Extraer `shortName` a formatters.ts | Embarques.tsx, ClienteDetalle.tsx, formatters.ts |
| 2 | Alta | Extraer hook para CotizacionDetalle | CotizacionDetalle.tsx, nuevo hook |
| 3 | Alta | Extraer columnas y hook para ClienteDetalle | ClienteDetalle.tsx, nuevo hook |
| 4 | Media | Extraer columnas y lógica de Embarques.tsx | Embarques.tsx, nuevos archivos |
| 5 | Media | Mover componentes JSX de profitUtils a components/ | profitUtils.tsx, nuevo componente |
| 6 | Media | Reorganizar helpers.ts | helpers.ts, nuevo archivo |
| 7 | Media | Extraer handlers de EmbarqueDetalle | EmbarqueDetalle.tsx, nuevo hook |
| 8 | Baja | Mover diálogos sueltos a carpetas por dominio | 3 archivos de componentes |
| 9 | Baja | Limpiar tipo legacy DocumentoProveedor | types.ts |
| 10 | Baja | Consolidar configs de estado | estadoConfig.ts, helpers.ts |

---

Ninguno de estos hallazgos representa un bug o riesgo de seguridad. Son mejoras de mantenibilidad y organización. Puedo implementarlos uno por uno si lo apruebas.


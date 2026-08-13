# Homologación de los detalles de Cliente y Proveedor

Objetivo: que ambas fichas se lean como diseñadas por el mismo equipo — misma anatomía de página, mismos estados (carga/vacío/error), mismos contadores y las mismas capacidades donde tenga sentido de negocio.

## Diagnóstico (verificado en código)

Ambas pantallas ya comparten los primitivos (`PageContainer`, `DetailHeader`, `KpiCard`, `DataTable` con `TABLE_DENSITY.embebida`, `FormDialogShell`, `DoubleConfirmDeleteDialog`, breadcrumb con `useRegisterBreadcrumbLabel`) y ninguna tiene colores fuera de token. Las diferencias reales:

| Aspecto | Cliente | Proveedor |
| --- | --- | --- |
| Franja de KPIs | grid propio en `ClienteSummaryCards` (6 tarjetas) | `KpiStrip` canónico (3 tarjetas + barra pagado/pendiente) |
| Envoltorio de pestaña | `ClienteTabSection` (un solo componente) | `Card` + contador copiado a mano en 3 lugares |
| Contador en pestañas | texto plano `Embarques (12)` | pill `bg-warning/15` sólo en "Por facturar", nada en el resto |
| Carga | spinner `Loader2` suelto | `DetailSkeleton` dentro de un `div p-8` (no `PageContainer`) |
| Vacío / error por pestaña | sólo `emptyMessage` en texto | `EmptyState` + `ErrorStateInline` por pestaña |
| Acciones de encabezado | botones planos (sin eliminar) | botón primario + menú "Más acciones" con Eliminar (admin) |
| Estado de cuenta | ruta aparte (`/clientes/:id/estado-de-cuenta`) | pestaña integrada con aging y export CSV/PDF |
| Expediente documental | no existe | pestaña Documentos con vigencias |
| Contactos múltiples | sí (`TablaContactos`) | no (campos sueltos) |
| Estado en columnas | `statusColumn` canónico | no lo usa |

`ProveedorDetalle.tsx` está en 199 líneas: cualquier cambio ahí exige extraer secciones primero.

## Ola 1 — Anatomía y estados compartidos (base visual)

1. Crear `src/components/shared/DetailTabSection.tsx` a partir de `ClienteTabSection` (título + contador + acciones + cuerpo `p-0 border-t`) y usarlo en las dos fichas; borrar `ClienteTabSection` y los tres `Card`+contador manuales de Proveedor.
2. Crear `src/components/shared/DetailTabsList.tsx` (o un helper `tabLabel`) para que **todas** las pestañas de las dos fichas muestren su contador con el mismo pill `text-2xs` (variante `warning` sólo cuando el contador implique pendientes).
3. Unificar el estado de carga: ambas usan `PageContainer` + `DetailSkeleton`. Se elimina `ClienteLoadingState` y el `div p-8` de Proveedor.
4. Bajar `ErrorStateInline` + `EmptyState` a nivel de pestaña en Cliente (Embarques, Cotizaciones, Contactos), como ya hace Proveedor.

## Ola 2 — Encabezado y franja de KPIs

1. Migrar `ClienteSummaryCards` a `KpiStrip` (`desktopCols={3}`), con `sublabel` de apoyo como en Proveedor, manteniendo los 6 indicadores.
2. Homologar el encabezado: en ambos, acción primaria `Editar` sólida + menú "Más acciones" (`MoreHorizontal`) para el resto. En Cliente, "Estado de cuenta" pasa al menú; Eliminar cliente sólo si el usuario es admin (con `DoubleConfirmDeleteDialog` y validación de dependencias del backend existente).
3. Añadir a Cliente los mismos badges de identidad que Proveedor (régimen/días de crédito), y a Proveedor el subtítulo `RFC / Tax ID` en la misma tipografía monoespaciada que Cliente.

## Ola 3 — Paridad funcional

1. **Cliente gana pestaña "Estado de cuenta"** reutilizando `EstadoCuentaModule` (`mostrarExportaciones` + identidad) sin duplicar lógica; la ruta actual sigue existiendo y se conserva el enlace desde el menú.
2. **Cliente gana pestaña "Documentos"** (expediente: CSF, comprobante, contrato) siguiendo el mismo patrón de `ProveedorDocumentosTab`, extraído a un componente compartido de expediente parametrizado por entidad.
3. **Proveedor gana pestaña "Contactos"** con el patrón de `TablaContactos` (si el backend no tiene tabla de contactos de proveedor, se propone crearla en una ola posterior; queda marcada como pendiente de confirmar antes de implementar).
4. Aplicar `statusColumn`/`StatusBadge` en las columnas de operaciones y movimientos de Proveedor para que los estados se vean igual que en las tablas de Cliente.

## Ola 4 — Guardas y cierre

1. Dividir `ProveedorDetalle.tsx` (199 líneas) en `_sections/ProveedorDetalleTabs.tsx` + `_sections/ProveedorFichasGrid.tsx`, dejando la ruta en ~90 líneas, igual que `ClienteDetalle.tsx`.
2. Documentar la anatomía "ficha de detalle" en `docs/design-system.md` (encabezado → franja KPI → fichas → pestañas con `DetailTabSection`) para que las próximas fichas (Embarque, Factura) nazcan iguales.
3. Correr auditorías (`audit:tests`, arquitectura, typecheck) y actualizar `CHANGELOG.md` + `APP_VERSION`.

## Notas técnicas

- Nada de lógica de negocio nueva en Olas 1–2: sólo presentación y composición.
- Los componentes nuevos viven en `src/components/shared/` para que Embarques/Facturas los adopten después.
- El expediente compartido y el estado de cuenta de Cliente reutilizan servicios y RPCs existentes; no se crean tablas nuevas salvo la de contactos de proveedor, que queda por confirmar.
- Todos los archivos nuevos ≤200 líneas, tokens semánticos, `text-2xs` en lugar de `text-[10px]`.

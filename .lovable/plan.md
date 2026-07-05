# Unificar el "design language" de todas las tablas

Auditamos las ~22 tablas de la app. La referencia es lo que quedó hoy en Facturación: fila entera clickeable, folio en texto plano, columnas construidas con `columnBuilders` compartidos (`statusColumn`, `moneyColumn`, `dateColumn`, `clientColumn`), sticky en la 1ª columna, responsive `hidden xl:table-cell`. Analogía: hoy cada tabla es un músico tocando en su tono; queremos que toda la orquesta afine con la misma partitura.

## Fase 1 — Homologación visual pura (sin cambiar acciones)

Cambios de estilo/columnas. No tocan navegación ni operaciones destructivas → riesgo bajo.

1. **CxP (`cxp/components/cxpColumns.tsx`)**
  - Estado: reemplazar `ESTATUS_COLOR` + `Badge` manual por `statusColumn` (dominio `factura_cxp`; crear en `statusRegistry` si no existe).
  - Montos Total/Pagado/Saldo: `moneyColumn` con `currencyAccessor`.
  - Fecha emisión / vencimiento: `dateColumn`.
2. **Comisiones (`comisiones/components/comisionesColumns.tsx`)**
  - Estado con `statusColumn` (dominio `comision`).
  - Cobrado / Comisión con `moneyColumn`.
  - Fecha con `dateColumn`.
  - Añadir `sticky: true` en la 1ª columna.
3. **CRM Oportunidades (`crm/routes/oportunidadesTable.ts`)**
  - `moneyColumn` para monto, `dateColumn` para fecha estimada.
  - Declarar `width` en todos los `meta`.
  - `hidden xl:table-cell` en vendedor / probabilidad.
4. **CRM Leads (`crm/routes/leadsColumns.tsx`)**
  - Declarar `width` en todos los `meta`.
  - `sticky: true` en la columna "empresa".
  - Estado usando `StatusBadge` unificado.
5. **Admin Organizaciones (`admin/components/AdminOrganizacionesColumns.tsx`)**
  - `sticky: true` en "nombre".
  - Reemplazar el Badge activo/inactivo por `StatusBadge`.
6. **Cliente Detalle — tabla embarques (`cliente/components/clienteColumns.tsx`)**
  - Cambiar `getEstadoColor` legacy + `Badge` por `statusColumn({ domain: "embarque" })`.
7. **Estandarizar color de `<Link>` dentro de celdas**
  - Unificar en `text-primary hover:underline` (interactivo) en `cxpAgingColumns.tsx`, `cxpPorCapturarColumns.tsx`, `ProveedorOperacionesTable.tsx`. Eliminar variantes con `text-accent` en links de celda.

## Fase 2 — Migración de tablas `<Table>` crudas a `DataTable`

Ahora usan `<Table>` de shadcn directamente → sin skeleton tipado, sin empty state, sin sort. Migrar preservando comportamiento:

8. `**bandejas/routes/Cartera.tsx**` → DataTable + `columnBuilders`. Links azules se mantienen (no hay `onRowClick`).
9. `**bandejas/routes/CxpPorPagar.tsx**` → ídem.
10. `**costeo/routes/CosteoNavieras.tsx**` y `**CosteoDemorasVenta.tsx**` → DataTable. Las acciones CRUD inline (editar/borrar en fila) se mantienen como celdas de acción; no se colapsan a kebab para no cambiar el flujo.

## Fase 3 — Decisiones de UX que tocan acciones (requieren tu OK)

Estos SÍ cambian comportamiento. Preguntas explícitas para ti antes de tocar:

- **Clientes (`clientesTableConfig.tsx`)**: el `actionsColumn` sólo tiene "Ver detalle", que duplica el click de fila. ¿Lo eliminamos por completo, o lo aprovechamos para acciones secundarias reales (Editar RFC, Desactivar)? Lo borramos. 
- **Cotizaciones (`cotizacionesColumns.tsx`)**: `actionsColumn` con Editar + Eliminar. "Eliminar" se queda (destructiva). ¿"Editar" abre modal in-list o va a la ruta de detalle? Si es ruta, lo quitamos porque el click de fila ya lleva ahí. Va a la ruta. 

Si me confirmas la política aquí, la aplico como Fase 3 en un segundo bump. Si prefieres que las deje intactas por ahora, cerramos con Fases 1+2.

## Detalles técnicos

- `**statusRegistry**`: antes de aplicar Fase 1, verificar que existan dominios `factura_cxp`, `comision`, `lead`, `oportunidad`, `org`. Si falta alguno, agregarlo a `src/lib/status/statusRegistry.ts` con sus variantes/colores. Cambio contenido, no debería afectar otros usos.
- `**ResponsiveDataTable**` (usado sólo en `reportes/ReportesTablaClientes.tsx`): fuera de alcance de esta unificación; evaluar después si conviene generalizarlo.
- `**configuracion/TabTiposContenedor` / `TabPuertos` / `TabNavieras**`: los switches inline + Trash2 son válidos para CRUD de catálogos; no se tocan.
- **Features de `DataTable` a NO cambiar**: `density`, `striped`, `initialSort` — dejamos los defaults actuales. Solo se ajusta `skeletonRows` cuando la tabla tiene menos de 5 filas típicas (Configuración, Bandejas cortas).
- **Verificación**: `bun run test` sobre los archivos tocados; snapshots de columnas si existen. Recorrido manual de `/facturacion`, `/cxp`, `/comisiones`, `/crm/*`, `/admin/organizaciones`, `/bandejas/*`, `/costeo/*`, `/clientes` para confirmar que la fila entera sigue clickeable donde ya lo era y que no se rompen anchos.

## Changelog

Un bump por fase para que los diffs sean revisables:

- `13.172.14` — Fase 1 (visual puro).
- `13.172.15` — Fase 2 (migración de tablas crudas).
- `13.172.16` — Fase 3 (sólo si confirmas política de `actionsColumn`).

Cada entrada listará los archivos tocados y la regla homologada.

## Fuera de alcance

- No se rediseñan encabezados, no se cambia paleta ni tipografía.
- No se toca el detalle de ninguna entidad.
- No se agrega paginación server-side donde no exista.
- No se cambian permisos/RLS ni queries de Supabase.
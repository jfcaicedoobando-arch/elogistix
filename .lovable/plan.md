
# Desglose "En detalle" inline en /compras/conciliacion

Hoy, al hacer click en una fila de la tabla de conciliación, la app navega a `/embarques/:id` y saca al usuario del contexto de conciliación. La propuesta es abrir un **panel lateral (Sheet)** con el desglose del embarque, sin salir de la pantalla, para poder revisar y operar en línea.

## Alcance

1. Sustituir la navegación por click en la fila por la apertura de un **Sheet lateral** (drawer derecho, ancho ~`xl`) con el detalle del embarque seleccionado.
2. Mantener disponible el "ir al embarque completo" como acción secundaria dentro del panel (botón "Abrir embarque"), para no perder el acceso actual.
3. Dentro del panel mostrar:
   - **Encabezado**: expediente, cliente, estado del embarque, moneda, badges de estado de conciliación.
   - **Resumen económico**: cotizado, real facturado, diferencia, % desviación, # conceptos sin factura. Se toma tal cual de `calcularResumen` en `reconciliacionCostos.ts`.
   - **Tabla de conceptos** (una fila por `concepto_costo`): concepto, proveedor, cotizado, real facturado, diferencia, % desviación, estado de liquidación, y lista de facturas de proveedor vinculadas (folio + monto).
   - **Acciones por concepto**:
     - "Vincular factura" → abre el flujo existente de captura/edición de factura de proveedor precargando ese concepto (reusa `vincularFacturaAConceptos` / pantalla de CxP).
     - "Ver factura" en cada folio vinculado → navega a `/compras/por-aprobar` (o al detalle de factura si existe) filtrando por ese folio.
4. Manejo de estados de carga y error del panel con `isLoading` y `EmptyState` cuando no haya conceptos.
5. Cerrar el panel con Escape / click fuera / botón cerrar; conservar filtros de la lista al cerrar.

## Detalles técnicos

- **Nuevo componente**: `src/features/compras/routes/_sections/ConciliacionDetalleSheet.tsx`.
  - Recibe `embarqueId | null` y `onClose`. Usa `Sheet` de `@/components/ui/sheet` (side="right", `w-full sm:max-w-3xl`).
  - Dispara `useQuery(["compras","conciliacion-detalle", embarqueId], () => fetchReconciliacionEmbarque(embarqueId))` reutilizando `src/features/embarques/services/reconciliacionCostos.ts` (ya existe, ya testeado). No se crea servicio nuevo.
  - Renderiza resumen calculado con `calcularResumen(filas)` (función pura existente).
  - Tabla con `DataTable` (density compact) siguiendo estándares del proyecto.
- **Edición de ComprasConciliacion.tsx**:
  - Reemplazar `onRowClick={row => navigate(...)}` por `onRowClick={row => setDetalleEmbarqueId(row.embarque_id)}`.
  - Añadir estado local `detalleEmbarqueId` y montar `<ConciliacionDetalleSheet embarqueId={detalleEmbarqueId} onClose={() => setDetalleEmbarqueId(null)} />`.
  - Botón "Abrir embarque" dentro del sheet navega a `/embarques/:id` (comportamiento anterior, ahora opcional).
- **Vincular factura desde el panel**: en Fase 1 el botón navega a `/compras/por-aprobar?embarque=<id>&concepto=<id>` (query params ya consumidos por la bandeja o se agregan si no existen). No se modifica lógica de negocio; sólo se pasa contexto por URL.
- **Tests**:
  - Unit test del componente `ConciliacionDetalleSheet` con mocks del servicio (`fetchReconciliacionEmbarque`) — loading, empty y con datos.
  - Ajustar el smoke test existente de `ComprasConciliacion` si aplica (no debería romperse, sólo cambia handler de click).
- **Estilos**: usar tokens semánticos (sin colores hardcoded). Reusar badges de estado existentes.
- **Versionado**: bump `APP_VERSION` a `13.184.0` y entrada en `CHANGELOG.md`:
  - `Conciliación de compras: desglose por embarque ahora se abre en un panel lateral sin salir de /compras/conciliacion.`

## Fuera de alcance (para próximo lote)

- Editar montos de conceptos/facturas desde el panel (sólo lectura + navegación a captura).
- Filtros dentro del panel (moneda/estado de línea) — se puede añadir después si se necesita.
- Cambios en RLS o servicios de base de datos.

## Diagrama

```text
/compras/conciliacion
┌───────────────────────────────────────────┐   ┌──────────────── Sheet ────────────────┐
│ KPIs + Filtros                            │   │ Expediente · Cliente · [Abrir embarque]│
│ ┌───────────────────────────────────────┐ │   │ Resumen: cotizado / real / Δ / %      │
│ │ Fila embarque  ← click abre panel ───►│ │──►│ Tabla conceptos_costo:                │
│ │ Fila embarque                          │ │   │  concepto · prov · cot · real · Δ · % │
│ └───────────────────────────────────────┘ │   │  [Vincular factura] [Ver folios]      │
└───────────────────────────────────────────┘   └──────────────────────────────────────┘
```

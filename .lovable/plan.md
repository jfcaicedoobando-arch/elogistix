# Auditoría UI/UX Fase 7 — Detalle de Cotización, Proveedores y Bitácora (v8.99.18)

Continuación de la auditoría visual sobre módulos no cubiertos. **Sí hay mejoras pendientes**, incluyendo un **bug visible de superposición de texto** en el detalle de cotización.

## Hallazgos por orden de severidad

### 1. Detalle de Cotización · BUG VISUAL (alta prioridad)
- En la card "Datos Generales", el campo **Operador** muestra el email crudo (`karla.garcia@elogistixshipping.com`) y, al desbordar la celda del grid, **se sobrepone con "Tiempo de tránsito 5 días"** del campo a la derecha. Texto encima de texto.
- Causas: no se aplica `nombreDesdeEmail` y la celda no tiene `truncate`/`min-w-0`.
- Adicional: el cliente del header (`INDIMEX TRADING`) está en MAYÚSCULAS — falta `toTitleCase`.
- Validez/Vigencia: dos campos casi redundantes ("Vigencia: 7 días (30/04/2026)" y "Validez propuesta: 30/04/2026"). Considerar fusionar en un solo campo o renombrar para que la diferencia sea clara.

### 2. Detalle de Cotización · Tab Costos
- Header `% PROFIT` rompe en 2 líneas — agregar `whitespace-nowrap`.
- La página entra **directo en modo edición** (inputs activos para Proveedor/Costo Unit. + botón flotante "Guardar Costos"). No hay botón "Editar" previo. Debería iniciar en modo lectura y entrar a edición vía acción explícita, igual que el resto del sistema. Esto evita guardados accidentales.
- Línea "Release" muestra `USD 95.00 + IVA` mientras otras líneas no muestran sufijo IVA — inconsistencia visual.
- Las columnas "Notas (opcional)" como `<textarea>` ocupan toda la fila incluso vacías; podrían colapsarse a un botón "+ Nota" que expanda al hacer click.

### 3. Proveedores
- Nombres mezclados: `COSCO SHIPPING LINES MEXICO S DE RL DE CV`, `EVERGREEN SHIPPING AGENCY MEXICO, S.A. DE C.V.`, `SHENZHEN GOLDEN SHIPPING CO.,LTD`, `WAN HAI LINES MEXIC`, `YANG MING`, `ZIM INTEGRATED SHIPPING SERVICES LTD`, `prueba` en MAYÚSCULAS/lowercase, junto a `Ocean Network Express Pte. Ltd.` en Title Case. Aplicar `toTitleCase` a la columna Nombre.
- Columna Contacto (`DARREN`, `Prueba`) — aplicar `toTitleCase`.
- Tabs de categorías (`Agentes Aduanales`, `Agentes de Carga`) están casi pegados visualmente — agregar `gap-1` o padding consistente.

### 4. Bitácora
- Usuarios mostrados como `alan.hernandez`, `valeria.zamora`, `magali.reynoso` (slug del email). Usar `nombreDesdeEmail` para obtener "Alan Hernandez", "Valeria Zamora", "Magali Reynoso".
- Timestamps relativos ("hace 2d") sin tooltip con fecha absoluta — agregar `title=` con la fecha en formato `dd/MM/yyyy HH:mm`.
- Acciones (`Editar`, `Cambiar Estado`) sin badge de color que las diferencie. Nice-to-have: aplicar variante de badge según tipo de acción (success para Crear, warning para Cambiar Estado, secondary para Editar, destructive para Eliminar).

### 5. Detalle de Cotización · Header
- El subtítulo del cliente debería pasar por `toTitleCase` (igual que ya hicimos en el header de Embarque en Fase 6).

## Plan de Trabajo (v8.99.18)

1. **CotizacionDetalle / Datos Generales** (`src/pages/cotizaciones/CotizacionDetalle.tsx` + componentes hijos):
   - Aplicar `nombreDesdeEmail` al campo Operador.
   - Agregar `min-w-0 truncate` (con tooltip via `title`) a las celdas del grid de datos para evitar overflow horizontal.
   - Aplicar `toTitleCase(cliente_nombre)` en el header.

2. **Tab Costos de Cotización**:
   - `whitespace-nowrap` en header `% Profit` y `Costo Unit.`.
   - Cambiar comportamiento por defecto a modo lectura. Agregar botón "Editar costos" que active los inputs y revele "Guardar Costos". Al guardar o cancelar, vuelve a modo lectura.
   - Quitar el sufijo "+ IVA" de la columna Venta (manejarlo en el resumen P&L que ya indica "El IVA no forma parte del profit").

3. **Lista de Proveedores** (`src/pages/proveedores/Proveedores.tsx` o columnas):
   - `toTitleCase` en columna Nombre y Contacto, con tooltip nativo.
   - `gap-1` o `space-x-1` en `TabsList` de categorías.

4. **Bitácora** (`src/pages/dashboard/Bitacora.tsx` y/o componente de fila):
   - Reemplazar el slug crudo del email por `nombreDesdeEmail`.
   - Agregar `title=` con `formatDateTime` al texto "hace 2d".
   - Mapear tipo de acción a `Badge` con variante semántica (`Crear` → success, `Editar` → secondary, `Cambiar Estado` → warning, `Eliminar` → destructive, `Login` → info).

5. **Changelog v8.99.18** documentando los 4 grupos.

## Detalles Técnicos

- Para el modo lectura/edición de costos en cotización: usar un estado local `const [editMode, setEditMode] = useState(false)` y condicionar el render de cada input vs `<span>{value}</span>`.
- La superposición del operador en cotización es un overflow del grid; añadir `overflow-hidden text-ellipsis whitespace-nowrap` en el `<p>` del valor o convertir a `truncate` con `min-w-0` en el contenedor flex.
- Para Bitácora, exponer un helper `getActionBadgeVariant(accion: string)` en `src/lib/ui/uiMappings.ts`.

## Archivos a Modificar (estimación)

- `src/pages/cotizaciones/CotizacionDetalle.tsx` (header)
- `src/components/cotizacion/SeccionDatosGenerales.tsx` (o similar — confirmar al implementar)
- `src/components/cotizacion/SeccionCostos.tsx` (modo edición)
- `src/pages/proveedores/Proveedores.tsx` o sus columnas
- `src/pages/dashboard/Bitacora.tsx` (o componente de fila)
- `src/lib/ui/uiMappings.ts` (mapper de badges)
- `src/content/changelog/v8/chunks/0.ts`

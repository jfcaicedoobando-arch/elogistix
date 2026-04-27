# Auditoría UI/UX Fase 6 — Pendientes en módulos no auditados (v8.99.17)

Recorrido de Pre-Facturación, Rentabilidad y Detalle de Embarque (módulos no cubiertos en fases anteriores). **Sí hay mejoras pendientes**, principalmente por inconsistencia de Title Case en módulos que se quedaron fuera del barrido previo.

## Hallazgos

### 1. Pre-Facturación · Tab Facturas
- Cliente `INDIMEX TRADING` en MAYÚSCULAS — falta `toTitleCase`.
- Columna `# FACTURA` rompe en 2 líneas (header).
- Folio de proforma `PRO-2026-0003` rompe en 2 líneas — falta `whitespace-nowrap`.
- Iconos de archivos (PDF rojo / XML azul) sin tooltip.

### 2. Pre-Facturación · Tab Liquidación de Gastos
- Proveedores **mezclados**: `LONGSAIL SUPPLY CHAIN CO.,LTD.`, `COSCO SHIPPING LINES MEXICO S DE RL DE CV`, `EVERGREEN SHIPPING AGENCY MEXICO, S.A. DE C.V.` en mayúsculas vs `Ocean Network Express Pte. Ltd.` en Title Case. Aplicar `toTitleCase`.
- Columna Monto duplica la moneda: muestra `USD 2,248.00` y luego columna separada `USD`. Eliminar la columna Moneda redundante (la cifra ya la incluye) o quitar el prefijo del monto.
- Filas en MXN muestran `$57,000.00` (signo $) mientras USD usa prefijo `USD`. Unificar a `MXN 57,000.00` para consistencia (el formatter ya lo soporta vía `formatCurrency`).

### 3. Pre-Facturación · Tab Proformas
- Estado vacío muestra **skeletons indefinidos** en lugar de un EmptyState cuando `count === 0`. Reutilizar `EmptyState` con icono `FileSpreadsheet`.
- Headers de columna (`# PROFORMA`, `BL MASTER`, `DÍAS CRÉDITO`, `MONTO USD`, `MONTO MXN`) rompen en 2 líneas — agregar `whitespace-nowrap`.

### 4. Pre-Facturación · Tab Pendientes
- Botones "Consolidar y aprobar" y "Aprobar individual" se ven activos cuando `0 seleccionadas` — confunde al usuario. Aplicar `disabled` real y el estilo deshabilitado del design system.
- EmptyState es texto plano — usar el componente `EmptyState` compartido.

### 5. Rentabilidad por Cliente
- Clientes en gráfica `Top 10 por Profit` y tabla `Desglose por Cliente` en MAYÚSCULAS (`INDIMEX TRADING`, `INVERSIONES Y SOLU...`, `FASTCOLD TECH`, `ENTERA SALUD ANIMA...`). Aplicar `toTitleCase`.
- Etiquetas largas del eje Y consumen ~40% del ancho de la gráfica. Solución: usar `shortName` (primera palabra significativa) o truncar a 18 chars con tooltip.
- Título "Top 10 por Profit" cuando solo hay 5 — cambiar a "Top {N} por Profit" dinámico.
- Labels "Desde" y "Hasta" pequeños y mal alineados con sus inputs — apilar como `<Label>` arriba del input, igual que "Modo".

### 6. Detalle de Embarque (Resumen)
- Subtítulo del cliente en header: `ROLLOS Y ETIQUETAS ROLLE...` en MAYÚSCULAS. Aplicar `toTitleCase`.
- Mercancía: `PLASTIC BAG` en MAYÚSCULAS. Capitalizar.
- Operador muestra `magali.reynoso@elogistixshipping.com` (email crudo) en Datos Generales. Aplicar `nombreDesdeEmail`.
- Shipper: `VIETPAK COMPANY LIMITED — Proveedor (VIETNAM)` — Title Case + el sufijo `(VIETNAM)` debería ser `(Vietnam)`.
- Consignatario: `ELOGISTIX SHIPPING S DE RL DE CV` — Title Case (el formatter ya soporta `S`, `DE`, `RL`, `CV`).

## Plan de Trabajo (v8.99.17)

1. **TabFacturas / TabProformas / TabLiquidacionGastos** (`src/components/facturacion/`):
   - Aplicar `toTitleCase` a clientes y proveedores.
   - Agregar `whitespace-nowrap` a headers y a folios.
   - Eliminar columna Moneda redundante en Liquidación; usar `formatCurrency(monto, moneda)` para el unique display.
   - Tooltips nativos (`title=`) en iconos PDF/XML ("Ver PDF", "Ver XML").

2. **TabPendientes** (`src/components/facturacion/TabPendientes.tsx`):
   - Pasar `disabled` real a los botones cuando `seleccionadas === 0`.
   - Reemplazar texto plano "No hay proformas pendientes" por `<EmptyState icon={CheckCircle2} title="Todo al día" description="No hay proformas pendientes de revisión." />`.

3. **Tab Proformas EmptyState**: Si `data.length === 0 && !isLoading`, mostrar `EmptyState` en lugar de skeletons.

4. **Reportes / Rentabilidad** (`src/pages/dashboard/Rentabilidad.tsx` o `src/pages/Reportes.tsx`):
   - Aplicar `toTitleCase` a `cliente_nombre` en gráfica (`Bar` con función `tickFormatter`) y tabla.
   - Limitar etiquetas del eje Y a 18 chars con `...` y `width=140`.
   - Cambiar título a `Top {top.length} por Profit`.
   - Reorganizar filtros con `<Label>` arriba en grid `flex-col gap-1`.

5. **EmbarqueDetalleHeader** (`src/components/embarque/EmbarqueDetalleHeader.tsx`):
   - Aplicar `toTitleCase(cliente_nombre)` en el subtítulo.

6. **TabResumen** (`src/components/embarque/TabResumen.tsx`):
   - Aplicar `toTitleCase` a Mercancía, Shipper y Consignatario.
   - Aplicar `nombreDesdeEmail` a Operador.

7. **Changelog v8.99.17** documentando los 6 grupos.

## Detalles Técnicos

- Reutilizar `EmptyState` ya creado en `src/components/empty/EmptyState.tsx` (Fase 5).
- Para evitar romper datos legítimos en mayúsculas (códigos como `WANHAI`, `FCL`, `MXESE`), no aplicar Title Case en columnas de códigos UN/LOCODE, navieras de catálogo, ni en BL/Contenedores.
- Eje Y de Recharts: `<YAxis dataKey="cliente" type="category" tickFormatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v} width={140} />`.

## Archivos a Modificar

- `src/components/facturacion/TabFacturas.tsx`
- `src/components/facturacion/TabProformas.tsx`
- `src/components/facturacion/TabLiquidacionGastos.tsx`
- `src/components/facturacion/TabPendientes.tsx`
- `src/pages/Reportes.tsx` (o equivalente Rentabilidad)
- `src/components/embarque/EmbarqueDetalleHeader.tsx`
- `src/components/embarque/TabResumen.tsx`
- `src/content/changelog/v8/chunks/0.ts`

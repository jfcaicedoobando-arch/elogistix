# Tab "Proyección" en Pre-Facturación (v8.117.0)

Nueva pestaña como **PRIMERA tab** (antes de "Pendientes") para cierre mensual de facturación basado en ETA de embarques.

## Objetivo
Visualizar en tiempo real el avance de facturación de cada mes: cuánto se proyecta facturar (por ETA), cuánto ya está facturado, profit estimado, y desglose por expediente. Pensado para presentar a socios.

## Estructura de la UI

```text
[Pre-Facturación]
┌─ Tabs: [Proyección] [Pendientes] [Proformas] [Facturas] [Liquidación]
│
├─ Selector de mes  [◀ Noviembre 2026 ▶]   [Exportar CSV]
│
├─ KPIs (4 tarjetas tipo KpiCard)
│   ┌──────────────┬──────────────┬──────────────┬──────────────┐
│   │ Embarques    │ Facturación  │ Profit       │ Avance       │
│   │ 24 totales   │ $1.2M / 2.1M │ $380K (18%)  │ 11/24 (46%)  │
│   │ 11 fact·13 p │ proy: $2.1M  │ Proy: $520K  │ Barra prog.  │
│   └──────────────┴──────────────┴──────────────┴──────────────┘
│
├─ Filtros: [Cliente ▼] [Operador ▼] [Estado ▼: todos/facturado/pendiente]
│
└─ Tabla detalle agrupada por expediente:
    Expediente · Cliente · Operador · ETA · Contenedores ·
    Venta · Costo · Profit · % · Estado [Facturado | Pendiente]
```

## Lógica de negocio

**Universo del mes seleccionado:** `embarques` con `eta` dentro del mes (rango `[primerDía, últimoDía]`) en la org actual.

**Agrupación por expediente:** si un expediente tiene múltiples filas (BL Master con varios contenedores), se suman venta/costo/profit y se cuentan contenedores. Estado consolidado: `Facturado` solo si TODOS los embarques del expediente cumplen la regla.

**Regla "Facturado":**
```
embarque.tiene_proforma === true
AND existe factura en `facturas` con embarque_id = X
    Y `factura_pdf_url` IS NOT NULL
```

**Cálculos:**
- `Venta` = SUM(`conceptos_venta.total`) del embarque (en MXN, convirtiendo USD/EUR con `tipo_cambio_usd/eur` del embarque vía `convertirAMXN`).
- `Costo` = SUM(`conceptos_costo.monto`) del embarque (misma conversión).
- `Profit` = Venta − Costo · `%` = profit / venta.
- **Proyectado vs Facturado** en KPIs: Proyectado = total de TODOS los embarques del mes; Facturado = solo embarques con estado `Facturado`.

**Selector de mes:** desde Abril 2026 hasta el mes actual + 12. Default: mes actual. Navegación con botones ◀/▶ y un `Select` con la lista. Estado en URL via `?mes=YYYY-MM` para compartir vistas.

## Archivos nuevos

1. **`src/services/facturas/proyeccion.ts`** — `fetchProyeccionMes(orgId, year, month)`:
   - Query embarques con `eta` en rango, select de `id, expediente, cliente_nombre, operador, eta, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma, contenedor`.
   - Query paralela `conceptos_venta` y `conceptos_costo` por `embarque_id IN (...)`.
   - Query paralela `facturas` (`embarque_id, factura_pdf_url`) para flag de facturado real.
   - Devuelve filas planas + función helper para agrupar por expediente.

2. **`src/lib/domain/proyeccionFacturacion.ts`** (puro, testeable):
   - `agruparPorExpediente(filas) → GrupoProyeccion[]`
   - `calcularKpisProyeccion(grupos) → { totalEmbarques, facturados, pendientes, ventaProy, ventaFacturada, costoTotal, profitProy, avancePct }`
   - Tipos `FilaProyeccion`, `GrupoProyeccion`, `KpisProyeccion`.

3. **`src/hooks/facturacion/useTabProyeccionController.ts`** — controlador:
   - Estado: `mes` (sincronizado con URL `?mes=YYYY-MM`), filtros (`cliente`, `operador`, `estado`).
   - `useQuery` con `queryKey: ['facturacion','proyeccion', orgId, mes]`, `staleTime: 60_000`.
   - `useMemo` para `gruposFiltrados`, `kpis`, `clientesDisponibles`, `operadoresDisponibles`.
   - `exportarCsv()` usando `exportToCsv` con columnas: expediente, cliente, operador, ETA, contenedores, venta, costo, profit, %, estado.

4. **`src/components/facturacion/TabProyeccion.tsx`** — UI:
   - Header: `MesSelector` (◀ Mes Año ▶ + Select con meses desde Abril 2026), botón Exportar.
   - Grid 4 `KpiCard` (reutiliza `src/components/operaciones/KpiCard.tsx`) con tonos: total (neutral), facturación (info), profit (success/warning según margen), avance (con `Progress`).
   - Card filtros (3 `Select` + `SearchInput` por expediente/cliente).
   - `DataTable` con columnas alineadas a la derecha (`tabular-nums`) para montos, `font-mono` para expediente. Badge "Facturado" verde / "Pendiente" amarillo. Render expandible si un expediente tiene >1 contenedor (mostrar fila resumen + chevron para ver contenedores).
   - Empty state con `EmptyStateInline` cuando el mes no tiene embarques.

5. **Tests** `src/lib/domain/__tests__/proyeccionFacturacion.test.ts`:
   - Agrupación correcta por expediente, suma de totales, conversión de monedas, regla "Facturado" (todos/algunos/ninguno con PDF).

## Archivos editados

- **`src/pages/facturacion/Facturacion.tsx`**: agregar `<TabsTrigger value="proyeccion">Proyección</TabsTrigger>` como primer trigger, `<TabsContent value="proyeccion">` con `<TabProyeccion />`. Cambiar `defaultValue` a `"proyeccion"`.
- **`src/lib/query/index.ts`**: agregar `queryKeys.facturacion.proyeccion`.
- **`src/constants/appVersion.ts`**: `8.117.0`.
- **`src/content/changelog/v8/chunks/0.ts`** y **`src/content/changelogData.ts`**: nueva entrada en español MX.

## Notas técnicas

- **Multi-tenant:** filtrar por `organization_id` vía `useOrgFilter` en el hook (RLS ya lo cubre, pero explicito mejora cache).
- **Performance:** una sola pasada al backend (3 queries en paralelo con `Promise.all`); cache de 60s. No requiere RPC nueva.
- **Localización:** mes formateado con `Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })`. Montos con `formatCurrency`. Fechas DD/MM/YYYY con `formatDate`.
- **Sin cambios de DB ni RLS.**
- **Reutiliza:** `KpiCard`, `DataTable`, `SearchInput`, `EmptyStateInline`, `exportToCsv`, `convertirAMXN`, `formatCurrency`.

## Cambios fuera de alcance (no incluidos)
- Edición de proformas/facturas desde esta tab (read-only).
- Comparativos vs mes anterior o YoY (se puede agregar en v8.118 si lo piden).
- Drilldown a `EmbarqueDetalle` (sí incluido: click en fila → `/embarques/:id`).

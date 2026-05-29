# Plan: Sección "Profit" en el sidebar

## 1. Sidebar — nueva sección "Profit"

`src/components/layout/sidebarItems.ts`:
- Crear `SIDEBAR_PROFIT_ITEMS` con dos entradas:
  - `{ title: "Proyección", url: "/profit/proyeccion", icon: TrendingUp }`
  - `{ title: "Estado de Resultados", url: "/profit/estado-resultados", icon: BarChart3 }` (o `LineChart`)
- Quitar/renombrar `SIDEBAR_REPORTES_ITEMS` (Rentabilidad) — propuesta: **dejarla** como sección "Reportes" con Rentabilidad (no estaba en el alcance moverla). Confirmar abajo.

`src/hooks/layout/useAppSidebarSections.ts`:
- Insertar nueva sección `{ label: "Profit", items: SIDEBAR_PROFIT_ITEMS }` entre "Gestión" y "CRM" (o entre CRM y Reportes). Visible para todos los roles excepto `vendedor`.

## 2. Mover Proyección fuera de Pre-Facturación

- `src/pages/facturacion/Facturacion.tsx`:
  - Quitar import + `TabsContent` + entrada del tab "1. Proyección".
  - Renumerar labels: "1. Por aprobar", "2. Proformas", "3. Facturas emitidas", "4. Pagos a proveedores".
  - `defaultValue="pendientes"`.
- `src/components/facturacion/GuiaPrefacturacion.tsx`: quitar paso "Proyección".
- Nueva página `src/pages/profit/ProfitProyeccion.tsx`: wrapper con `PageHeader` + `<TabProyeccion />`. Reutilizar el componente intacto (incluye el hueco de facturación que ya agregamos).
- No mover archivos del hook/servicio/lib (cambio de scope mínimo); sólo el host de la página cambia.

## 3. Nueva página Estado de Resultados (P&G)

`src/pages/profit/ProfitEstadoResultados.tsx` + controller/hook + servicio:

### Datos (servicio nuevo `src/services/profit/estadoResultados.ts`)
- Query sobre `embarques` filtrando por `eta` dentro del mes seleccionado y `organization_id`. Traer `id, modo, tipo_cambio_usd, tipo_cambio_eur`.
- Para esos embarques: traer `conceptos_venta` y `conceptos_costo` (`descripcion, monto, moneda, embarque_id`).
- Agrupación en memoria:
  - Por **modo** (`Marítimo`, `Aéreo`, `Terrestre`) → columnas.
  - Por **descripción normalizada** (trim + lowercase para grouping key, mostrar versión original más frecuente) → filas.
  - Conversión a MXN con `convertirAMXN` usando `tipo_cambio_usd/eur` del embarque (mismo patrón que `sumarConceptosEnMxn` en `lib/domain/proyeccionFacturacion/conversion.ts`).

### UI
- `PageHeader` "Estado de Resultados".
- Selector de mes (mismo patrón que `useTabProyeccionController`, lista desde **Abril 2026**; sincronizado a URL `?mes=YYYY-MM`).
- Botón "Exportar CSV" (usa `exportToCsv`).
- Tabla profesional (HTML `<table>` con Tailwind, no DataTable porque es matriz pivot):
  ```
                          Marítimo   Aéreo   Terrestre   TOTAL
  INGRESOS
    Flete marítimo        ...        -       -           ...
    Maniobras             ...        ...     ...         ...
    ...
    TOTAL INGRESOS        ===        ===     ===         ===
  COSTOS
    Flete naviera         ...        -       -           ...
    ...
    TOTAL COSTOS          ===        ===     ===         ===

  UTILIDAD BRUTA          ===        ===     ===         ===
  MARGEN %                xx.x%      xx.x%   xx.x%       xx.x%
  ```
- Formato MXN (`formatMoney`), filas de totales con fondo `bg-muted` y bold; encabezados de sección (`INGRESOS`/`COSTOS`) con `bg-primary/5`.
- Skeleton mientras carga, empty-state si no hay datos del mes.

### Cálculo
- Helper puro `src/lib/domain/estadoResultados.ts` (≤200 LOC):
  - `buildEstadoResultados(embarques, ventas, costos): { ingresos: Fila[], costos: Fila[], totalesIngresos, totalesCostos, utilidad, margen }` por modo.
  - Usar `currency.js` para sumas (mismo patrón que `profitUtils.ts`).
- Hook `src/hooks/profit/useEstadoResultados.ts` con `useQuery`, key `['profit','estado-resultados', orgId, mesKey]`.

### Export CSV
- Headers: `Sección, Concepto, Marítimo, Aéreo, Terrestre, Total`.
- Filename: `estado-resultados-YYYY-MM.csv`.

## 4. Rutas

`src/routes/appRoutes.tsx`:
```tsx
<Route path="/profit/proyeccion" element={<ProfitProyeccion />} />
<Route path="/profit/estado-resultados" element={<ProfitEstadoResultados />} />
<Route path="/profit" element={<Navigate to="/profit/proyeccion" replace />} />
```
Lazy-loaded como las otras páginas.

## 5. Permisos
- Acceso igual al actual de Pre-Facturación / Reportes (admin, operador). Definir vía `usePermissions` si aplica.

## 6. Changelog & versión
- Bump `APP_VERSION` a `12.17.0` (feature).
- `CHANGELOG.md` con entrada `## [12.17.0] - 2026-05-29`: nueva sección Profit, Proyección movida, Estado de Resultados nuevo.

## Archivos

**Nuevos**
- `src/pages/profit/ProfitProyeccion.tsx`
- `src/pages/profit/ProfitEstadoResultados.tsx`
- `src/hooks/profit/useEstadoResultados.ts`
- `src/hooks/profit/index.ts`
- `src/services/profit/estadoResultados.ts`
- `src/services/profit/index.ts`
- `src/lib/domain/estadoResultados.ts`
- `src/lib/query/keys/profit.ts` (+ registrar en `keys` index)

**Editados**
- `src/components/layout/sidebarItems.ts`
- `src/hooks/layout/useAppSidebarSections.ts`
- `src/pages/facturacion/Facturacion.tsx`
- `src/components/facturacion/GuiaPrefacturacion.tsx`
- `src/routes/appRoutes.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

## Verificación
- `bunx vitest run` verde.
- Probar manualmente: navegación a `/profit/proyeccion` muestra la tab Proyección intacta con hueco; `/profit/estado-resultados` muestra P&G con selector de mes y export CSV; Pre-Facturación ya no tiene tab Proyección.

## Preguntas para confirmar (no bloquean si no hay respuesta)
1. ¿La sección "Reportes" (Rentabilidad) se mantiene como está, o quieres moverla también dentro de "Profit" como tercer item? Por defecto: **se mantiene aparte**.
2. ¿Filas dinámicas incluyen todos los conceptos sin importar monto, o ocultar filas con total 0 en todas las columnas? Por defecto: **ocultar filas en cero**.
3. ¿Incluir embarques en cualquier estado (incluso Cancelado), o sólo activos/cerrados? Por defecto: **excluir Cancelado**.

# Sprint 6 — Dashboard Ejecutivo Financiero (v12.49.0)

Consolidar en una sola vista los módulos financieros existentes (EERR, Cartera, Tesorería, Comisiones, Presupuesto, Flujo 90d) para que dirección tenga un tablero único de decisión.

## Objetivo

Una ruta `/profit/dashboard-ejecutivo` que muestre el estado financiero global de la organización en menos de 2s, con datos reales de los servicios ya construidos en Sprints 1-4. Sin duplicar lógica, sin nuevas tablas.

## Alcance funcional

### 1. Selector de periodo (header)
- Presets: Mes actual / Mes anterior / YTD / Trimestre / Personalizado.
- Default: Mes actual. Persistido en `safeSessionStorage` (`STORAGE_KEYS`).
- Filtro de moneda visualización: MXN (base) / USD (convertido con `useTasaCambio`).

### 2. Banda de 6 KPI cards
- Ingresos del periodo
- Utilidad neta + margen %
- Saldo total en bancos (todas las cuentas activas)
- Cartera vencida >0 días (monto + count)
- CxP por pagar próximos 7 días
- Variación presupuesto vs real (color: verde <100%, ámbar 100-110%, rojo >110%)

Cada card: valor principal, delta vs periodo anterior, ícono, click → ruta del módulo origen.

### 3. Gráfico EERR 12 meses (`ComposedChart` Recharts)
- Barras: Ingresos / Costos / Gastos.
- Línea: Utilidad neta.
- Reusa `fetchEstadoResultados` con rango rolling 12m.

### 4. Tarjeta saldos por banco
- Tabla compacta: banco, cuenta, saldo MXN, saldo USD.
- Total al pie.
- Reusa `fetchResumenTesoreria`.

### 5. Top 5 deudores / Top 5 acreedores (dos tarjetas lado a lado)
- Cliente/Proveedor, monto, días vencido, badge de severidad.
- Reusa servicios de cartera CxC/CxP.

### 6. Mini flujo proyectado 4 semanas
- `LineChart` con saldo proyectado semanal.
- Reusa `fetchFlujoProyectado(28)`.

### 7. Panel de alertas (lateral derecha)
- Reglas deterministas (sin IA):
  - Saldo bancario proyectado < 0 en próximas 4 semanas
  - Facturas CxC vencidas >30 días con monto >umbral configurable
  - Categoría de presupuesto con variación >110%
  - CxP vencidas
- Cada alerta: severidad, descripción, link a la vista de origen.

## Arquitectura técnica

### Backend / servicios
- `src/services/dashboard-ejecutivo/agregador.ts` — orquestador único que llama en paralelo (`Promise.all`) a los servicios ya existentes:
  - `fetchEstadoResultados(periodo)`
  - `fetchEstadoResultados(rolling12m)`
  - `fetchResumenTesoreria()`
  - `fetchFlujoProyectado(28)`
  - `fetchPresupuestoVsReal(periodo)`
  - `fetchComisionesDevengadas(periodo)`
  - `fetchTopDeudores(5)` / `fetchTopAcreedores(5)` (nuevos wrappers ligeros sobre servicios CxC/CxP existentes)
- Cálculo de alertas: función pura `calcularAlertas(snapshot)` en `src/services/dashboard-ejecutivo/alertas.ts`.
- Tipos en `src/services/dashboard-ejecutivo/types.ts`.
- Sin nueva tabla. Sin RPC nueva. Sin migración.

### Hook
- `src/hooks/dashboard-ejecutivo/useDashboardEjecutivo.ts`
  - `useQuery` con `queryKey: queryKeys.dashboardEjecutivo.snapshot(periodo, organizationId)`
  - `staleTime: 60_000`, `gcTime: 300_000`
- Registrar dominio en `EXPECTED_DOMAINS` (`src/lib/query/index.ts`) + keys en `src/lib/query/keys/dashboardEjecutivo.ts`.

### UI / componentes (todos ≤200 LOC)
- `src/pages/profit/ProfitDashboardEjecutivo.tsx` (página, ≤150 LOC)
- `src/components/dashboard-ejecutivo/SelectorPeriodo.tsx`
- `src/components/dashboard-ejecutivo/BandaKPIs.tsx` + `KpiCard.tsx`
- `src/components/dashboard-ejecutivo/GraficoEERR12m.tsx`
- `src/components/dashboard-ejecutivo/SaldosBancosCard.tsx`
- `src/components/dashboard-ejecutivo/TopListaCard.tsx` (reusable deudores/acreedores)
- `src/components/dashboard-ejecutivo/MiniFlujoCard.tsx`
- `src/components/dashboard-ejecutivo/AlertasPanel.tsx`
- Skeletons en cada tarjeta; error boundary local.

### Ruta y navegación
- Registrar en `src/routes/appRoutes.tsx` con lazy load + chunk recovery.
- Item en sidebar bajo grupo "Profit" como primer hijo, ícono `LayoutDashboard`.
- Permisos: `admin`, `contador` → vista completa; `comercial`, `vendedor` → sólo KPIs de ingresos/cartera; `operador` → sin acceso.

### Exportación PDF
- `src/pdf/documents/ReporteEjecutivoDocument.tsx` (3 páginas):
  1. Header + KPIs + EERR 12m + saldos bancos
  2. Top deudores + Top acreedores + alertas
  3. Mini flujo + variación presupuesto
- Botón "Exportar PDF" en header, usa `@react-pdf/renderer` ya instalado.

### Localización y formato
- `es-MX`, MXN base, `DD/MM/YYYY`, `financialUtils.ts` para sumas, `useTasaIVA` no requerido (vista informativa).
- Conversión USD vía `useTasaCambio` (cache 1h Frankfurter).

### Tests
- `src/services/dashboard-ejecutivo/__tests__/alertas.test.ts` — reglas deterministas (≥6 casos).
- `src/lib/query/__tests__/keys-shape.test.ts` — incluir nuevo dominio.
- `src/pages/profit/__tests__/ProfitDashboardEjecutivo.test.tsx` — smoke con mocks.

## Fuera de alcance
- Comparativo año contra año.
- Drilldown interactivo dentro de las gráficas.
- Export Excel.
- Notificaciones push / email (Sprint 5).
- Personalización de layout por usuario.

## Power of 10 / cumplimiento
- Componentes ≤200 LOC.
- Cero `any`.
- Sin `style={{}}` estático.
- Multi-tenant: todas las queries filtran por `organization_id` activo del contexto.
- Cleanup en `useEffect` (no hay suscripciones realtime en este sprint).
- `safeSessionStorage` para persistencia de filtro.

## Entregables
1. Servicios + tipos + alertas
2. Hook + query keys
3. UI (página + 7 componentes)
4. Ruta + sidebar + permisos
5. PDF ejecutivo
6. Tests (alertas + smoke + keys-shape)
7. `CHANGELOG.md` + bump `APP_VERSION` → `12.49.0`

## Riesgos
- Tiempo de carga si los 6 servicios se ejecutan en serie → mitigado con `Promise.all`.
- Inconsistencia de monedas → forzar MXN base, conversión sólo en UI.
- Permisos comercial/vendedor: validar en agregador, no sólo en UI.

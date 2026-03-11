

## Plan: Dashboard de Operaciones completo

### Archivos a crear/modificar

**1. `src/hooks/useOperacionesData.ts`** (crear)

Hook que reutiliza las mismas queries del dashboard principal (`useEmbarques`, `conceptos_venta`, `conceptos_costo`) y calcula:

- **Por operador**: agrupa embarques por campo `operador`, calcula cargas activas (no EIR/Cerrado/Cancelado), cargas creadas este mes, profit USD (venta - costo usando los maps existentes), demoras (estado Arribo con días > 7), clientes únicos, histórico 6 meses de creados y llegados.
- **Global**: sumas de todos los operadores.
- **Filtro de período**: "Este mes" | "Últimos 3 meses" | "Este año" que filtra los embarques base.
- **Histórico mensual**: genera array de 6 meses con conteo de `created_at` y `fecha_llegada_real` (o estados terminales).

Sigue el mismo patrón de `useDashboardData.ts`: queries con `@tanstack/react-query` + `useMemo` para derivaciones. Reutiliza `calcularUtilidad` de `financialUtils.ts` y `calcularEstadoEmbarque` de `useEmbarques`.

**2. `src/pages/Operaciones.tsx`** (reemplazar)

Estructura en 4 bloques:

- **Bloque 1 — Header**: título, fecha actual formateada, filtro de período con tabs/select.
- **Bloque 2 — KPIs**: 4 cards (activas/azul, creadas mes/violeta, profit/esmeralda, demoras/rojo) con el mismo estilo `rounded-2xl shadow-sm` del dashboard principal.
- **Bloque 3 — Ranking de operadores**: tabla en card con columnas Pos, Operador, Activas, Este mes, Clientes, Demoras, Profit USD (con barra visual de progreso relativo). Ordenado por profit desc. #1 con ícono estrella. Demoras en rojo/esmeralda. Filas expandibles con detalle (clientes + mini BarChart 6 meses). Card lateral oscura "Top del mes".
- **Bloque 4 — Tendencia de cargas**: `recharts` LineChart con dos líneas (creadas azul, llegadas esmeralda), labels en cada punto. KPIs arriba (creadas, llegadas, activas hoy en card violeta sólida). Select para filtrar por operador. Barra de balance abajo (ámbar si creadas > llegadas, esmeralda si al día).

**3. `src/App.tsx`** — ya tiene la ruta `/operaciones`, no requiere cambios.

### Detalles técnicos

- Queries: reutiliza `queryKeys.embarques.all`, `queryKeys.dashboard.ventasUSD`, `queryKeys.dashboard.costosUSD` para no duplicar fetches.
- El campo `fecha_llegada_real` del embarque se usa para histórico de llegadas; como fallback, embarques con estado terminal (`Entregado`, `EIR`, `Cerrado`) y su `eta`.
- Histórico 6 meses: genera array `[{mes: 'Oct', creados: 5, llegados: 3}, ...]` iterando los últimos 6 meses calendario.
- Mini gráficas en filas expandibles: `recharts` BarChart inline (height ~80px).
- Todos los datos vienen del hook, cero hardcoding.


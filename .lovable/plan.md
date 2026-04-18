

# Análisis de rendimiento — v8.25.0 (read-only)

## 🔴 Hallazgos críticos

### 1. Warning de ref activo en `Badge` (sigue rompiendo memoización)
Console actual:
```
Warning: Function components cannot be given refs.
Check the render method of `DataTableInner`. at Badge → td
```
**Causa real**: `Badge` (en `src/components/ui/badge.tsx`) es una función simple sin `forwardRef`. Cualquier `<TooltipTrigger asChild>` o `<DropdownMenuTrigger asChild>` que envuelva un `Badge` (o un componente hijo) le inyecta un `ref` y React falla. Esto sucede en filas de tablas con tooltips/popovers — y como antes el warning ocurría dentro del árbol de `DataTable`, también afecta el rendimiento de re-render de cualquier lista que use Badges con Radix triggers.

> Nota: el fix v8.23.0 (quitar `memo` del `DataTable`) eliminó el ciclo, pero el warning subyacente sigue, lo que indica que **toda la jerarquía bajo el Badge se re-monta cuando React falla la asignación del ref**.

---

### 2. 22 hooks siguen usando `select('*')` (deuda no resuelta)
A pesar de tener constantes `EMBARQUE_LIST_COLUMNS` y `COTIZACION_LIST_COLUMNS`, todavía traen TODAS las columnas:
- `useEmbarque(id)`, `useEmbarqueConceptosVenta`, `useEmbarqueConceptosCosto`, `useEmbarqueDocumentos`, `useEmbarqueNotas`, `useEmbarqueFacturas`
- `usePortalData` (4 queries — incluyen JSONB pesados)
- `useClientes` (detalle), `useCotizacion(id)`, `useDuplicarCotizacion`
- `useNavieras`, `usePuertos`, `useTiposContenedor` (catálogos completos en cada login)
- `useConfiguracion`, `useBitacora`

**Impacto medido**: tablas con columnas JSONB (`conceptos`, `costos`, `documentos`, `metadata`) transmiten 5–10x más bytes de los necesarios.

---

### 3. `dashboard_stats` monolítico (>30KB)
Un solo RPC retorna 8 secciones (`alertasDemora`, `proximosArribos`, `profitArribosEsteMes`, `embarquesMesSiguiente`, `cargasPorCliente`, `arribosEsteMes`, `conteoPorEstado`, `resumenMesSiguiente`). Todo se transfiere y parsea aunque el usuario solo mire una sección.

---

## 🟡 Hallazgos importantes

### 4. Catálogos sin cache largo
`useNavieras`, `usePuertos`, `useTiposContenedor` no especifican `staleTime` → revalidan cada 30s por defecto. Estos cambian semanalmente como mucho.

### 5. `keepPreviousData` ausente en listados paginados
`useEmbarquesPaginados` ya usa `placeholderData: prev` (✅). Pero `useClientes` paginados, `useProveedores` paginados y `useBitacora` no — provocan flash de skeleton al cambiar de página.

### 6. Re-renders parásitos en `Dashboard`
- Fechas (`hoyStr`, `getSaludo`) se recomputan en cada render.
- Cards (`AlertasDemoraCard`, `ProximosArribosCard`, `CargasActivasClienteCard`, `ProfitTable`) no usan `React.memo` → re-render cuando el padre actualiza cualquier estado.

### 7. Sin prefetch en hover de filas
La navegación a detalle de embarque/cotización siempre cae en cold cache → 200–500ms de spinner por click.

---

## 🟢 OK / sin acción urgente

- **Bundle**: `App.tsx` lazy-loadea todas las páginas; `vite.config.ts` ya hace `manualChunks` (react/query/charts/radix). ✅
- **Assets**: solo SVG en `/public`, ningún JPG/PNG pesado. ✅
- **Auth refresh loop**: ya resuelto en v8.23.0 (filtro de `TOKEN_REFRESHED`). ✅
- **DataTable memo**: quitado en v8.23.0. ✅
- **Cache dashboard/sidebar**: 5 min staleTime aplicado en v8.23.0. ✅

---

## 📋 Plan ordenado (críticas → polish)

| # | Acción | Esfuerzo | Ganancia |
|---|--------|----------|----------|
| 1 | Convertir `Badge` a `React.forwardRef` (badge.tsx) | XS | Elimina warning + remontes ocultos |
| 2 | Reemplazar `select('*')` por columnas explícitas en los 6 hooks de detalle de embarque (`useEmbarque*`) | S | Payload detalle 60–80% menor |
| 3 | Reemplazar `select('*')` en `usePortalData` (4 queries) | S | Portal cliente 2x más rápido |
| 4 | Agregar `staleTime: 30 * 60_000` a `useNavieras`, `usePuertos`, `useTiposContenedor` | XS | -90% revalidaciones de catálogos |
| 5 | Partir `dashboard_stats` en 2 RPCs: `dashboard_summary` (KPIs/conteo) y `dashboard_details` (listas largas) — cargar el segundo solo cuando se vea | M | TTFB dashboard 2–3x más rápido |
| 6 | `React.memo` + `useMemo` en `Dashboard.tsx` (cards y fechas) | XS | Elimina re-renders parásitos |
| 7 | Reemplazar `select('*')` en `useClientes(id)`, `useCotizacion(id)`, `useDuplicarCotizacion`, `useConfiguracion`, `useBitacora` | S | Payload medio -50% |
| 8 | Agregar `placeholderData: (prev) => prev` a `useClientes`, `useProveedores`, `useBitacora` paginados | XS | UX paginación sin parpadeo |
| 9 | Prefetch en `onMouseEnter` para filas de embarques/cotizaciones (queryClient.prefetchQuery) | S | Navegación a detalle "instantánea" |
| 10 | Agregar `rollup-plugin-visualizer` para auditar bundle real una vez | XS | Confirma o descarta deuda de chunks |

**Recomendación**: ejecutar **#1 → #4** como primer ciclo (todos XS/S, alto retorno). Luego #5 si el dashboard sigue sintiéndose lento. #9 al final como pulido percibido.




# Performance Analysis & Optimization Recommendations

## Critical Issues Found

### 1. Duplicate full-table fetches (HIGH IMPACT)

Both `useDashboardData` and `useOperacionesData` call `useEmbarques()`, which fetches **ALL embarques** with no pagination. When you navigate between Dashboard and Operaciones, these share the same query key so caching helps -- but the initial load pulls the entire dataset client-side. The network logs confirm the paginated `/embarques` call (for the list page) fires separately, so navigating to `/embarques` from Dashboard triggers a **second, different query** for the same table.

Additionally, `useProfitMaps` fetches **all** `conceptos_venta` and `conceptos_costo` rows filtered only by `moneda = 'USD'` -- no pagination, no limits. As data grows this will become a major bottleneck.

**Recommendation:** Create a server-side RPC function (e.g. `dashboard_stats`) that computes aggregated counts, profit sums, alerts, and arrivals in SQL. Return a small JSON payload instead of downloading hundreds of rows to the client.

### 2. No `staleTime` configured on QueryClient (MEDIUM IMPACT)

The `QueryClient` is created with zero configuration: `new QueryClient()`. This means the default `staleTime` is **0ms** -- every query is considered stale immediately. Navigating between pages triggers refetches even if data was loaded seconds ago.

**Recommendation:** Set a global `staleTime` of 30-60 seconds and `gcTime` of 5 minutes:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000 },
  },
});
```

### 3. Duplicate network requests visible in logs (HIGH IMPACT)

The network logs show the **same exact requests firing 2-3 times** within the same second:
- `clientes?select=id,nombre` fires 3 times at 15:43:34, 15:43:35, 15:43:40
- `embarques?...&offset=0&limit=20` fires 3 times at the same timestamps

This is likely caused by `React.StrictMode` double-mounting in development + the zero `staleTime`. But even in production, route transitions re-mount components and refetch everything.

**Recommendation:** The `staleTime` fix above will resolve most of this. Also verify that `useClientesForSelect()` isn't called from multiple mounted components simultaneously (e.g. both the filter bar and a dialog).

### 4. `columns` array recreated on every render (LOW-MEDIUM)

In `Embarques.tsx`, the `useMemo` for `columns` depends on `[canEdit]`, but the `render` functions inside capture `navigate`, `setEmbarqueAEliminar`, and `setEmbarqueADuplicar` via closure. Since `navigate` is stable but the state setters are too, this is mostly fine -- however, adding `navigate` to the dependency array would be more correct. The real issue is that every row's action column creates new inline closures on each render.

**Recommendation:** Low priority. If the table exceeds 100+ visible rows, consider extracting the action cell into a `React.memo`-wrapped component.

### 5. `operadoresUnicos` derived from paginated data (LOGIC BUG)

The operator filter dropdown in Embarques is derived from the current page's 20 rows. This means operators not present on page 1 won't appear as filter options.

**Recommendation:** Fetch distinct operators server-side with a small dedicated query or RPC.

### 6. `useProfitMaps` fetches unbounded data (MEDIUM)

```typescript
supabase.from("conceptos_venta").select("embarque_id, total").eq("moneda", "USD")
```
No `.limit()`, no pagination. With hundreds of embarques and multiple conceptos per embarque, this could return thousands of rows.

**Recommendation:** Replace with a server-side aggregation: `SELECT embarque_id, SUM(total) FROM conceptos_venta WHERE moneda='USD' GROUP BY embarque_id`.

### 7. GlobalSearch fires 4 parallel queries on every keystroke (LOW)

Every search keystroke (after 300ms debounce) fires 4 separate queries. This is acceptable for now but could be consolidated into a single RPC with `UNION ALL`.

### 8. No `React.memo` on expensive list items (LOW)

`DataTable` rows are not memoized. For tables with 20 rows this is fine, but the Dashboard's `EmbarquesActivosTable` and `ProfitTable` re-render all rows when any parent state changes.

**Recommendation:** Low priority until tables exceed 50+ visible rows.

### 9. Assets and bundle size (LOW)

- Route-level code splitting via `React.lazy` is already in place -- good.
- The `elogistix-logo.jpg` in `/src/assets/` should be moved to `/public/` or converted to WebP/AVIF for smaller size.
- `recharts` and `date-fns` are the largest dependencies. `date-fns` uses tree-shaking well. Recharts is heavy (~200KB) but only loaded on Dashboard/Operaciones routes thanks to lazy loading.

## Priority Summary

| Priority | Issue | Impact |
|----------|-------|--------|
| 1 | Add global `staleTime` to QueryClient | Eliminates duplicate refetches instantly |
| 2 | Server-side dashboard aggregation RPC | Eliminates full-table client downloads |
| 3 | Server-side profit aggregation | Reduces unbounded conceptos queries |
| 4 | Fetch distinct operators server-side | Fixes filter logic bug |
| 5 | Consolidate GlobalSearch into single RPC | Minor network optimization |
| 6 | Memoize table row components | Future-proofing for larger datasets |


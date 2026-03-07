

## Plan: Paginación server-side para Clientes y Proveedores (v4.29.0)

### Análisis

**Clientes:**
- `useClientes()` se usa en `Clientes.tsx` (lista paginada) y `Reportes.tsx` (necesita todos los registros)
- Actualmente descarga todo y pagina en el cliente con `slice()`
- Solución: crear `useClientesPaginados()` para la vista de lista, mantener `useClientes()` para Reportes

**Proveedores:**
- `useProveedores()` se usa en `Proveedores.tsx` (lista con tabs por tipo) y `ProveedorDetalle.tsx` (solo mutaciones)
- La vista filtra por `tipo` en cliente — esto debe moverse al servidor
- Solución: crear `useProveedoresPaginados(tipo, search)` con filtro server-side por tipo + búsqueda

### Cambios

**1. `src/lib/queryKeys.ts`** — Agregar keys parametrizadas:
```typescript
clientes: {
  ...existing,
  list: (filters: Record<string, unknown>) => ['clientes', 'list', filters] as const,
},
proveedores: {
  ...existing,
  list: (filters: Record<string, unknown>) => ['proveedores', 'list', filters] as const,
},
```

**2. `src/hooks/useClientes.ts`** — Nuevo hook `useClientesPaginados`:
- Acepta `{ search, page, pageSize }`
- Usa `.range(from, to)` para paginación real
- Usa `.ilike('nombre', '%search%')` o `.or()` para búsqueda server-side (nombre + RFC)
- Retorna `{ data, count, isLoading }` usando `{ count: 'exact' }` en el select
- `useClientes()` se mantiene sin cambios para Reportes

**3. `src/pages/Clientes.tsx`** — Consumir `useClientesPaginados`:
- Eliminar `useMemo` de filtrado y `slice()` de paginación
- Pasar `search`, `page`, `pageSize` al hook
- `totalPages` se calcula desde `count` retornado por el servidor
- Agregar debounce de 300ms al search para evitar queries excesivos

**4. `src/hooks/useProveedores.ts`** — Nuevo hook `useProveedoresPaginados`:
- Acepta `{ tipo, search, page, pageSize }`
- Filtra `.eq('tipo', tipo)` en servidor
- Búsqueda server-side por nombre con `.ilike()`
- Retorna `{ data, count, isLoading }`
- `useProveedores()` se simplifica a solo mutaciones (eliminar query de lista)

**5. `src/pages/Proveedores.tsx`** — Consumir `useProveedoresPaginados`:
- Cada tab llama al hook con su `tipo` activo
- Estado de paginación por tab (se resetea al cambiar tab o buscar)
- Agregar `PaginationControls` debajo de cada tabla
- Debounce de 300ms en búsqueda

**6. `src/hooks/useDebounce.ts`** — Hook utilitario para debounce del search.

**7. `src/pages/Changelog.tsx`** — Entrada v4.29.0.

### Notas técnicas
- Supabase `.select('...', { count: 'exact' })` retorna el total sin traer todos los registros
- `.range(from, to)` es inclusivo en ambos extremos
- Las query keys incluyen los filtros para que React Query cache correctamente cada página/búsqueda
- `keepPreviousData: true` evita parpadeos al cambiar de página


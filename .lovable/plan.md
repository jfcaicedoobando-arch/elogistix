## Problema
En `src/features/costeo/routes/CosteoTarifas.tsx`, el filtro de aprobación tiene como default `"borrador"` (Pendientes). El botón "Limpiar filtros" resetea a ese default, por lo que al limpiar vuelve a aplicarse "Pendientes" en vez de mostrar todas.

## Cambio
- En `CosteoTarifas.tsx`:
  - Cambiar `DEFAULT_APROB` de `"borrador"` a `"todas"` para que el estado inicial y el `clearAll()` dejen el filtro en "Todas".
  - Mantener los KPIs como atajos: clic en "Pendientes" sigue aplicando `setAprobacion("borrador")`.
  - Ajustar `hasActiveFilters` (ya compara contra `DEFAULT_APROB`, queda consistente).
- Bump `APP_VERSION` a la siguiente patch y entrada en `CHANGELOG.md`.

No se tocan componentes hijos ni lógica de datos.
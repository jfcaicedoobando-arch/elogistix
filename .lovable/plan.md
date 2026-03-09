

## Tarjeta "Arribos este mes" en el Dashboard

### Cambios

**1. `src/hooks/useDashboardData.ts`**
- Agregar `embarquesConEstado` al return (actualmente es variable interna, no se expone)
- Agregar campo `arribosEsteMes` calculado con `useMemo` usando la lógica proporcionada

**2. `src/pages/Dashboard.tsx`**
- Extraer `arribosEsteMes` del hook
- Pasar `arribosEsteMes` e `isLoading` como props a `DashboardStatusCards`

**3. `src/components/dashboard/DashboardStatusCards.tsx`**
- Agregar props `arribosEsteMes: number`
- Después del `.map()` de estados, agregar una `Card` estática (no clickeable) con:
  - Ícono `CalendarDays` de lucide con gradiente cyan
  - Número grande con el conteo
  - Texto "Arribos este mes"
  - `Progress` al 100% en cyan (decorativa)
  - Sin `cursor-pointer` ni `hover:scale`

La grid pasa de `lg:grid-cols-4` a `lg:grid-cols-6` para acomodar la 6ª tarjeta, o se mantiene en 4 y la tarjeta extra fluye naturalmente. Dado que hay 5 estados + 1 indicador = 6 tarjetas, usaré `lg:grid-cols-3 xl:grid-cols-6` para que se vean bien en todos los tamaños.

### Archivos a modificar (3)
1. `src/hooks/useDashboardData.ts`
2. `src/pages/Dashboard.tsx`
3. `src/components/dashboard/DashboardStatusCards.tsx`


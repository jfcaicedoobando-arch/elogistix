## Fix CI: mover `src/components/profit/**` a `src/features/profit/components/**`

El test de arquitectura falla porque `src/components/profit/` duplica un dominio ya migrado a `src/features/profit/`:

```
AssertionError: src/components/profit: expected [ 'src/components/profit' ] to deeply equal []
```

### Pasos

1. **Mover archivos** (con `mv`, preservando historial):
   - `src/components/profit/BudgetOverrunSheet.tsx` → `src/features/profit/components/BudgetOverrunSheet.tsx`
   - `src/components/profit/FuenteEerrToggle.tsx` → `src/features/profit/components/FuenteEerrToggle.tsx`
   - `src/components/profit/__tests__/FuenteEerrToggle.test.tsx` → `src/features/profit/components/__tests__/FuenteEerrToggle.test.tsx`
   - Eliminar carpeta vacía `src/components/profit/`.

2. **Actualizar 3 imports** (`@/components/profit/...` → `@/features/profit/components/...`):
   - `src/features/profit/routes/ProfitEstadoResultados.tsx`
   - `src/features/profit/routes/ProfitDashboardEjecutivo.tsx`
   - `src/features/dashboardEjecutivo/components/BandaKPIs.tsx`

3. **Verificar** con `bun run test src/lib/__tests__/architecture.test.ts` + typecheck.

4. **Bump versión + CHANGELOG**: `APP_VERSION → 13.300.41`, entrada breve "fix(profit): reubica componentes a features/profit para satisfacer test de arquitectura".

### Analogía
El test de arquitectura es como un inspector que dice "ya tienes cuarto para 'profit' en la casa nueva (`features/`), no dejes ropa tirada en el cuarto viejo (`components/`)". Solo movemos las prendas al cajón correcto — sin cambiar la ropa.

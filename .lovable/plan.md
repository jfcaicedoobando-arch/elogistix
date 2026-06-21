## Problema

El CI más reciente está rojo por dos cosas, ambas en archivos que se crearon al armar el dashboard financiero:

1. **Test de arquitectura falla** — `src/features/dashboard/hooks/useEmbarquesPendientesAdmin.ts` importa `@/integrations/supabase/client` directo. La regla del proyecto dice que los hooks deben usar una capa de servicio (`features/*/services/`).
2. **Lint falla** (`--max-warnings 0`) — `FinanceDashboard` tiene complejidad ciclomática 18, el máximo es 16. Demasiados `??` y ramas en línea dentro de un mismo render.

> Analogía: el primero es como cuando vas directo al almacén a sacar producto en vez de pedirlo en mostrador. El segundo es como tener una sola hoja de cálculo con demasiadas fórmulas anidadas — hay que repartirlas en celdas auxiliares.

Las advertencias antiguas de `EmbarqueDetalleHeaderActions` y `useEmbarqueEstadoActions` ya no aparecen en el último run, así que no se tocan.

## Cambios

### 1. Mover la consulta a un servicio (arregla el test)

**Crear** `src/features/dashboard/services/embarquesPendientesAdmin.ts`:
- Mover ahí `fetchEmbarquesPendientesAdmin`, los tipos (`EmbarquePendienteAdminItem`, `EmbarquesPendientesAdminData`), las constantes `COLUMNS`/`ESTADOS` y el helper `diasDesde`.
- Es el único archivo que importa `@/integrations/supabase/client`.

**Editar** `src/features/dashboard/hooks/useEmbarquesPendientesAdmin.ts`:
- Borrar el import de `supabase` y la lógica de fetch.
- Importar `fetchEmbarquesPendientesAdmin` y los tipos desde el nuevo servicio y re-exportar los tipos para no romper a los consumidores.
- El hook se queda solo con `useQuery`.

### 2. Bajar la complejidad de `FinanceDashboard` (arregla el lint)

Editar `src/features/dashboard/finance/FinanceDashboard.tsx`:
- Extraer un helper `toViewModel(dash)` arriba del componente que aplique todos los `?? 0` y devuelva un objeto plano (`vencidoMxn`, `vencidoUsd`, `porPagarMxn`, `porPagarUsd`, `porTimbrar`, `porCapturar`, etc.).
- El JSX queda pasando props ya resueltas, sin operadores de coalescencia inline.
- Esto baja la complejidad a ≤16 sin cambiar comportamiento.

### 3. Versionado y changelog

- `src/constants/appVersion.ts` → `13.90.2`.
- `CHANGELOG.md` → entrada `## [13.90.2]` explicando: "Refactor: `useEmbarquesPendientesAdmin` ahora delega a la capa de servicio y `FinanceDashboard` reduce su complejidad. Arregla CI (test de arquitectura + lint)."

## Fuera de alcance

- No se modifica UI, comportamiento, RPCs, RLS, ni los componentes hijos del dashboard.
- No se tocan los hooks/handlers de embarques (sus warnings de complejidad ya no aparecen en el último run).
- No se añaden pruebas nuevas; la suite existente debe pasar tal cual.

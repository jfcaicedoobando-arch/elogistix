## Objetivo

Ocultar el estado **"En Proceso"** de las tarjetas y conteos del dashboard, sin eliminarlo de la base de datos ni de la máquina de estados (sigue siendo un estado válido lateral en BD).

## Cambios

1. **`src/features/dashboard/domain/parsers/dashboardTypes.ts`**
   - Redefinir `ESTADOS_FILTRO` para excluir `"En Proceso"` (dejar sólo `Confirmado`, `En Tránsito`, `Arribo`, `En Aduana`, `Entregado`, `EIR`).
   - Quitar la clave `"En Proceso": 0` de `EMPTY_CONTEO`.

2. **`src/features/dashboard/domain/parsers/dashboard.ts`**
   - En `parseConteoPorEstado`, eliminar la línea `"En Proceso": Number(raw["En Proceso"] ?? 0)`. Los embarques en ese estado siguen existiendo pero no aparecen en la timeline del dashboard.

3. **Tests**
   - `src/features/dashboard/domain/parsers/__tests__/dashboard.test.ts` y `src/features/dashboard/hooks/__tests__/useDashboardController.test.tsx`: quitar la clave `"En Proceso"` de los fixtures del conteo esperado.

4. **Changelog + versión**
   - Bump `APP_VERSION` a `v13.303.41`.
   - Entrada en `CHANGELOG.md` explicando que "En Proceso" ya no se muestra en el dashboard (sigue vivo en BD como estado lateral; el botón "Avanzar estado" en el detalle del embarque lo sigue moviendo a Arribo).

## Fuera de alcance

- No se toca la máquina de estados de BD ni las transiciones.
- No se modifican `ESTADOS_ACTIVOS` (que se usa en otros módulos como Operaciones), sólo el filtro visual del dashboard.
- No se hace migración de datos: los embarques que hoy están "En Proceso" seguirán allí; simplemente no se contarán en la timeline del dashboard hasta que avancen a Arribo.

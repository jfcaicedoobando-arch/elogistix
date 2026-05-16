## Hallazgo visual confirmado

- En el dashboard, el chip **Arribo** muestra **4**.
- Al hacer clic, la app navega a `/embarques?estado=Arribo`.
- En Embarques se muestran **2 contenedores en 2 expedientes**, también al cambiar paginación a **10 / 20 / 50**.
- La base confirma que deberían aparecer **4 contenedores en 4 expedientes**: `ELIMP00097`, `ELIMP00111`, `ELIMP00112`, `ELIMP00194`.

## Causa probable

El dashboard calcula `Arribo` con la fecha del servidor (`current_date`). En Embarques, el filtro por estado recalcula el estado en frontend con `new Date()`. Por zona horaria/fecha efectiva, los embarques con ETA **16/05/2026** todavía no están cayendo como `Arribo` en la vista del navegador, aunque el backend ya los cuenta como `Arribo`.

## Plan de corrección

1. **Unificar el cálculo de “hoy” para filtros visuales de embarques**
   - Ajustar `src/lib/domain/embarque.ts` para que `calcularEstadoEmbarque` compare fechas por calendario UTC/ISO de forma estable, no por la zona horaria local del navegador.
   - Mantener intactas las reglas existentes: estados manuales siguen ganando (`Arribo`, `En Aduana`, `Entregado`, `EIR`, `Cerrado`).

2. **Blindar el listado de Embarques**
   - Confirmar que `useEmbarquesPageState.ts` siga filtrando el set completo antes de paginar cuando hay `estado=Arribo`.
   - Dejar el conteo como: contenedores reales filtrados + expedientes únicos.

3. **Verificación visual obligatoria**
   - Repetir el flujo en preview: dashboard → clic en Arribo → Embarques.
   - Verificar que el header diga **4 contenedores en 4 expedientes**.
   - Cambiar paginación a **10 / 20 / 50** y confirmar que no desaparecen filas.

4. **Changelog y versión**
   - Subir versión patch.
   - Agregar entrada al inicio de `src/pages/Changelog.tsx` / changelog vigente del proyecto, documentando el ajuste de conteos Dashboard vs Embarques.
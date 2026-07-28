## Qué pasó

En el embarque `646ee5ee…` (tab Facturación) hay 6 proformas, y una de ellas — **PRO-2026-0281** — ya fue borrada el 24/07/2026 (tiene `deleted_at` con fecha). Aun así sigue apareciendo en la lista, porque la consulta que alimenta esa tabla no excluye los registros borrados.

Al presionar "Eliminar" sobre esa fila, el backend busca una proforma viva con ese ID, no la encuentra y responde `Registro no encontrado o ya borrado` (P0001). El mensaje del backend es correcto: el problema es que la fila nunca debió estar visible.

Analogía: es como una carpeta que ya está en la papelera pero cuyo ícono quedó pegado en el escritorio; al intentar tirarla otra vez, el sistema dice "esa carpeta ya no existe".

## Alcance del problema (verificado)

Consultas de proformas que **no** filtran `deleted_at`:

- `fetchProformasEmbarque` — tabla de proformas dentro del embarque (donde ocurrió el error)
- `fetchProformasTodas` — listado `/proformas`
- `fetchProformasAprobadas` — listado de aprobadas
- `fetchProformaPorId` — detalle `/proformas/:id` (abre proformas borradas como si estuvieran vivas)
- `facturar.ts` — lectura previa a facturar (puede facturar una proforma borrada)

Ya filtran correctamente: `fetchProformasPendientes` y `proformasListas.ts`.

## Qué haré

1. **Filtrar borrados en las consultas**: agregar `deleted_at IS NULL` a las cuatro consultas de `src/features/proformas/services/queries.ts` y al `select` previo de `facturar.ts`.
2. **Detalle coherente**: si `/proformas/:id` apunta a una proforma borrada, mostrar el estado vacío canónico (`DetailNotFound`) con retorno al listado, en vez de renderizar datos de un registro en papelera. La recuperación sigue siendo por `/admin/papelera`.
3. **Mensaje y auto-recuperación al eliminar**: cuando el borrado falle con "Registro no encontrado o ya borrado", mostrar un aviso claro ("Esta proforma ya había sido eliminada; se actualizó la lista") e invalidar las cachés del embarque para que la fila fantasma desaparezca sin recargar la página.
4. **Tests**:
   - unitarios de las consultas verificando que se aplica el filtro `deleted_at` (mock de Supabase ya existente en `services/__tests__/queries.test.ts`);
   - test del hook `useEliminarProforma` verificando el mensaje amable y la invalidación de caché ante P0001;
   - test del detalle mostrando `DetailNotFound` para una proforma borrada.
5. **Changelog + versión**: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Notas técnicas

- No hace falta migración: la función `soft_delete_record` se comporta bien; el defecto está en la capa de lectura.
- Las políticas RLS de `proformas` no filtran `deleted_at` (por diseño, para que la papelera funcione), así que el filtro debe vivir en las consultas de la app.
- No se tocará `fetchProformasPendientes` ni `proformasListas.ts` (ya correctos).

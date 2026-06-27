## Problema

En la búsqueda global (Ctrl+K), al teclear `149` aparece **dos veces** el expediente `ELIMP00149` (cliente INDIMEX TRADING). No es un bug de UI: en la BD hay dos filas en `embarques` con el mismo expediente porque es un embarque multi-contenedor (dos BL Master distintos: `034G523190` y `034G521324`).

El listado de embarques ya deduplica por expediente (`dedupePorExpediente`), pero el RPC `busqueda_global` no — devuelve una fila por contenedor.

## Solución propuesta

Deduplicar por `expediente` dentro del bloque de embarques del RPC `public.busqueda_global`, devolviendo **una sola entrada por expediente** y agregando al sublabel el número de contenedores cuando hay más de uno (consistente con el listado).

### Cambios técnicos

1. **Migración SQL** — reemplazar el `SELECT` de embarques en `busqueda_global` por uno con `DISTINCT ON (e.expediente)`:
   ```sql
   SELECT DISTINCT ON (e.expediente)
          e.id, e.expediente AS label,
          e.cliente_nombre
            || CASE WHEN COUNT(*) OVER (PARTITION BY e.expediente) > 1
                    THEN ' · ' || COUNT(*) OVER (PARTITION BY e.expediente) || ' contenedores'
                    ELSE '' END AS sublabel,
          'embarque'::text AS tipo,
          '/embarques/' || e.id AS url
   FROM embarques e
   WHERE e.expediente ILIKE '%' || termino || '%'
     AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
   ORDER BY e.expediente, e.created_at ASC
   LIMIT limite
   ```
   El `id` que se navega será el del primer contenedor (más antiguo); al abrirlo, la vista de embarque ya muestra todos los relacionados por BL/expediente.

2. **Sin cambios en frontend** — `GlobalSearch.tsx` y `useGlobalSearch` consumen el mismo shape.

3. **Mantenimiento**
   - Bump `APP_VERSION` a `13.139.2`.
   - Entrada en `CHANGELOG.md`: "Búsqueda global: deduplicar embarques multi-contenedor por expediente".

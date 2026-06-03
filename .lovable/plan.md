# Fix: triángulo de "docs pendientes" cuenta documentos eliminados

## Causa raíz

El RPC `public.embarques_list_extras(p_ids)` calcula `docs_pendientes` con:

```sql
count(*) FILTER (WHERE d.archivo IS NULL AND d.estado <> 'No aplica')
FROM documentos_embarque d
WHERE d.embarque_id = ANY(p_ids)
```

**No filtra `d.deleted_at IS NULL`.** En `ELIMP00216` existe un `Certificado de Origen` soft-eliminado (`deleted_at = 2026-05-18 23:52`, `estado = 'Pendiente'`, `archivo NULL`) que se sigue contando, mientras que la vista real del embarque ya lo oculta. Resultado: tooltip "1 doc pendiente" sin documento visible.

El mismo bloque tiene el problema en el subquery de `conceptos_costo` (no filtra `deleted_at`), aunque ese impacto es menor porque hoy no se soft-deletean costos con frecuencia.

## Cambios

### 1. Migración SQL — `embarques_list_extras`

Reemplazar la función agregando `AND d.deleted_at IS NULL` y `AND c.deleted_at IS NULL` (si la columna existe en `conceptos_costo`; verificar antes de incluir).

```sql
CREATE OR REPLACE FUNCTION public.embarques_list_extras(p_ids uuid[])
RETURNS TABLE(embarque_id uuid, costos_total bigint, costos_pagados bigint, docs_total bigint, docs_pendientes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.id,
    COALESCE(cc.total, 0), COALESCE(cc.pagados, 0),
    COALESCE(dd.total, 0), COALESCE(dd.pendientes, 0)
  FROM unnest(p_ids) AS e(id)
  LEFT JOIN (
    SELECT c.embarque_id,
      count(*) AS total,
      count(*) FILTER (WHERE c.estado_liquidacion = 'Pagado') AS pagados
    FROM conceptos_costo c
    WHERE c.embarque_id = ANY(p_ids)
      AND c.deleted_at IS NULL  -- solo si la columna existe
    GROUP BY c.embarque_id
  ) cc ON cc.embarque_id = e.id
  LEFT JOIN (
    SELECT d.embarque_id,
      count(*) AS total,
      count(*) FILTER (WHERE d.archivo IS NULL AND d.estado <> 'No aplica') AS pendientes
    FROM documentos_embarque d
    WHERE d.embarque_id = ANY(p_ids)
      AND d.deleted_at IS NULL
    GROUP BY d.embarque_id
  ) dd ON dd.embarque_id = e.id;
$$;
```

### 2. `CHANGELOG.md` + `src/constants/appVersion.ts`

Bump a `12.51.13` con bullet: "Embarques: el contador de documentos pendientes (triángulo amarillo) ya no incluye documentos eliminados."

## Fuera de alcance

- No se tocan componentes frontend; el cálculo ya consume el valor del RPC.
- Duplicados de documentos (p.ej. dos BL Master activos en ELIMP00216) no son bug del contador — son datos reales y se atenderían por separado si el usuario lo solicita.

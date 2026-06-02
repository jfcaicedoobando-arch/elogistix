## Migración retroactiva: unificar embarques duplicados por expediente

Consolidar embarques que comparten **`(organization_id, expediente, cliente_id, bl_master)`** en un único embarque "padre", reapuntando todas las tablas hijas y eliminando los duplicados.

### Diagnóstico (datos reales)

Clave de agrupación elegida: `(organization_id, expediente, cliente_id, bl_master)`. Usar sólo `expediente` mezclaría casos legítimos (ej. `ELIMP00149` tiene **2 BLs distintos** en 11 embarques, son 2 envíos diferentes que deben quedar separados).

| Métrica | Valor |
|---|---|
| Grupos a unificar | **34** |
| Embarques afectados | **158** |
| Embarques a borrar (no-padres) | **124** |
| Embarques resultantes tras merge | **34** |

### Tablas hijas a reapuntar (FK a `embarques.id`)

```
auditoria_revisiones          conceptos_costo           cotizaciones
comisiones_devengadas         conceptos_venta           documentos_embarque
embarque_contenedores         eventos_embarque          facturas
notas_embarque                proforma_conceptos_consolidados
proformas                     tracking_externo          tracking_links
```

Único constraint a vigilar: `tracking_externo (embarque_id, provider)` — si el padre y un hijo tienen el mismo `provider`, dejar el del padre y descartar el del hijo (registrar en backup).

### Estrategia

1. **Snapshot/backup** en una tabla `_backup_merge_embarques_20260602` con copia completa de los 124 embarques que se borrarán + manifest del mapeo `hijo_id → padre_id`. Reversible vía script si algo sale mal.
2. **Elegir padre por grupo**: el embarque con `created_at` más antiguo (más estable, suele tener referencias externas).
3. **Sumar agregados al padre** antes de mover hijos: `peso_kg`, `volumen_m3`, `piezas` = suma del grupo. `tipo_cambio_usd`, `tipo_cambio_eur`, `estado`, `etd`, `eta`, `fecha_llegada_real` → conservar los del padre (regla determinística, no se promedian).
4. **Renumerar `orden` en `embarque_contenedores`** del padre y de los hijos antes del UPDATE, para evitar colisiones lógicas (no hay UNIQUE constraint en `orden`, pero conviene mantener `1..N` correlativo).
5. **UPDATE masivo** en todas las hijas: `SET embarque_id = padre_id WHERE embarque_id IN (hijos)`. Caso especial `tracking_externo`: borrar primero las filas duplicadas por `(padre_id_destino, provider)` antes del UPDATE.
6. **DELETE hard** de los 124 embarques hijos (después de verificar que no quedan FKs apuntándoles).
7. **Validación post-migración** integrada en la misma transacción: assertion `SELECT count(*) FROM embarques WHERE id IN (hijos)` debe ser 0; `count(*) FILTER (WHERE n>1)` por la clave debe ser 0; si falla, `ROLLBACK`.

### Estructura SQL (resumen)

```sql
BEGIN;

-- 1) Backup
CREATE TABLE _backup_merge_embarques_20260602 AS
SELECT e.*, p.padre_id
FROM embarques e
JOIN (SELECT id, first_value(id) OVER (...) AS padre_id, ...) p USING (id)
WHERE p.padre_id <> e.id;

-- 2) Tabla temporal con mapeo hijo→padre
CREATE TEMP TABLE _map AS
WITH grp AS (
  SELECT id,
    first_value(id) OVER (
      PARTITION BY organization_id, expediente, cliente_id, COALESCE(bl_master,'')
      ORDER BY created_at, id
    ) AS padre_id
  FROM embarques WHERE deleted_at IS NULL
)
SELECT id AS hijo_id, padre_id FROM grp WHERE id <> padre_id;

-- 3) Sumar agregados al padre
UPDATE embarques p SET
  peso_kg = COALESCE(p.peso_kg,0) + s.suma_peso,
  volumen_m3 = COALESCE(p.volumen_m3,0) + s.suma_vol,
  piezas = COALESCE(p.piezas,0) + s.suma_piezas
FROM (
  SELECT padre_id, sum(peso_kg) AS suma_peso, sum(volumen_m3) AS suma_vol, sum(piezas) AS suma_piezas
  FROM embarques e JOIN _map m ON m.hijo_id = e.id GROUP BY padre_id
) s WHERE p.id = s.padre_id;

-- 4) Renumerar orden de contenedores (DENSE_RANK por padre + created_at)
WITH renumber AS (
  SELECT ec.id, row_number() OVER (
    PARTITION BY COALESCE(m.padre_id, ec.embarque_id)
    ORDER BY ec.embarque_id = COALESCE(m.padre_id, ec.embarque_id) DESC, ec.orden, ec.created_at
  ) AS nuevo_orden
  FROM embarque_contenedores ec
  LEFT JOIN _map m ON m.hijo_id = ec.embarque_id
  WHERE ec.embarque_id IN (SELECT padre_id FROM _map UNION SELECT hijo_id FROM _map)
)
UPDATE embarque_contenedores ec SET orden = r.nuevo_orden FROM renumber r WHERE r.id = ec.id;

-- 5) Resolver duplicados en tracking_externo antes del UPDATE
DELETE FROM tracking_externo t
USING _map m, tracking_externo padre
WHERE t.embarque_id = m.hijo_id
  AND padre.embarque_id = m.padre_id
  AND padre.provider = t.provider;

-- 6) UPDATE masivo en todas las hijas
UPDATE embarque_contenedores  SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE conceptos_costo        SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE conceptos_venta        SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE proformas              SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE facturas               SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE comisiones_devengadas  SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE documentos_embarque    SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE eventos_embarque       SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE notas_embarque         SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE tracking_links         SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE tracking_externo       SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE cotizaciones           SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE auditoria_revisiones   SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;
UPDATE proforma_conceptos_consolidados SET embarque_id = m.padre_id FROM _map m WHERE embarque_id = m.hijo_id;

-- 7) Borrar embarques hijos
DELETE FROM embarques WHERE id IN (SELECT hijo_id FROM _map);

-- 8) Validación
DO $$
DECLARE
  v_orfanos int;
  v_duplicados int;
BEGIN
  SELECT count(*) INTO v_orfanos FROM embarques WHERE id IN (SELECT hijo_id FROM _map);
  SELECT count(*) INTO v_duplicados FROM (
    SELECT 1 FROM embarques WHERE deleted_at IS NULL
    GROUP BY organization_id, expediente, cliente_id, COALESCE(bl_master,'')
    HAVING count(*) > 1
  ) x;
  IF v_orfanos > 0 OR v_duplicados > 0 THEN
    RAISE EXCEPTION 'Validacion fallida: orfanos=%, duplicados=%', v_orfanos, v_duplicados;
  END IF;
END$$;

COMMIT;
```

Toda la operación va en **una sola transacción**, así que si cualquier paso falla se hace ROLLBACK automático y la BD queda intacta.

### Bitácora

Insertar 1 entrada en `bitacora_actividad` por grupo unificado con `accion = 'unificar_embarques'`, `entidad = 'embarque'`, `entidad_id = padre_id`, payload con array de `hijos_id`.

### Out of scope (no toca esta migración)

- Cambios de UI o lógica de negocio. La migración es 100% datos.
- No se renombra ni se altera `expediente` (sigue admitiendo repetición; el agrupado correcto se logra con la combinación de columnas).
- No se reescriben PDFs ya emitidos (proformas/facturas siguen apuntando al nuevo padre vía FK; el contenido del PDF generado en su momento no cambia, lo cual es correcto).

### Verificación previa a aplicar

Antes de ejecutar la migración real, generaré una migración separada **read-only** (un `SELECT` de inspección con el mapeo propuesto y las sumas) y pediré tu visto bueno con la muestra de los 34 grupos antes de tocar nada.

### Rollback

Si después de aplicada se detecta un problema funcional:
1. Restaurar embarques desde `_backup_merge_embarques_20260602` (INSERT ... SELECT).
2. Volver a apuntar las hijas: requiere también backup de los `embarque_id` previos de cada hija — por eso el backup incluye un manifest hijo→padre y el script de rollback puede reconstruir.

### Confirmación que necesito antes de ejecutar

1. ¿La clave de agrupación `(org, expediente, cliente_id, bl_master)` es correcta o prefieres exigir además `puerto_origen + puerto_destino`?
2. ¿OK con la regla "padre = más antiguo por `created_at`" o prefieres otra (ej. el que tiene más proformas/facturas asociadas, para minimizar reapuntes)?
3. ¿OK con sumar `peso_kg + volumen_m3 + piezas`, o se conservan los del padre tal cual?
4. Si dices "ejecutar", aplico primero el **dry-run de inspección** (sólo SELECT) para que revises los 34 grupos antes de la migración destructiva.

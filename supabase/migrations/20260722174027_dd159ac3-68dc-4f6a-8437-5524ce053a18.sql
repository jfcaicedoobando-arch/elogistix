
BEGIN;
SET LOCAL app.bypass_cierre = 'on';

WITH dups AS (
  SELECT (array_agg(id ORDER BY created_at))[2:] AS del_ids
  FROM embarque_contenedores
  WHERE numero_contenedor IS NOT NULL AND numero_contenedor <> ''
  GROUP BY embarque_id, upper(numero_contenedor) HAVING COUNT(*)>1
)
DELETE FROM embarque_contenedores WHERE id IN (SELECT unnest(del_ids) FROM dups);

UPDATE embarques SET bl_house = NULL WHERE upper(trim(bl_house)) = 'NA';

CREATE UNIQUE INDEX IF NOT EXISTS uq_embarque_contenedor_numero
  ON embarque_contenedores (embarque_id, upper(numero_contenedor))
  WHERE numero_contenedor IS NOT NULL AND numero_contenedor <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_sustituye_a_viva
  ON facturas (sustituye_a)
  WHERE sustituye_a IS NOT NULL AND estado <> 'Cancelada';

COMMIT;

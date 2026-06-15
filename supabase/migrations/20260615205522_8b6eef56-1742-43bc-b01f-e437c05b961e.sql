-- Limpieza de filas duplicadas en documentos_embarque que disparan
-- hallazgos críticos falsos en la regla docs_pendientes_avanzado.
-- Estrategia: para cada (embarque_id, nombre) conservar la "mejor" fila
-- (Recibido > No aplica > Pendiente; con archivo > sin archivo; más reciente)
-- y borrar las demás. Luego, un índice único parcial evita reincidencia.

WITH ranked AS (
  SELECT
    id,
    embarque_id,
    nombre,
    ROW_NUMBER() OVER (
      PARTITION BY embarque_id, nombre
      ORDER BY
        CASE estado::text
          WHEN 'Recibido'  THEN 1
          WHEN 'No aplica' THEN 2
          WHEN 'Pendiente' THEN 3
          ELSE 4
        END,
        CASE WHEN archivo IS NOT NULL AND archivo <> '' THEN 0 ELSE 1 END,
        created_at DESC,
        id
    ) AS rn
  FROM documentos_embarque
  WHERE deleted_at IS NULL
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM documentos_embarque
WHERE id IN (SELECT id FROM losers);

-- Índice único parcial: bloquea futuros duplicados activos.
CREATE UNIQUE INDEX IF NOT EXISTS documentos_embarque_unico_por_nombre
  ON public.documentos_embarque (embarque_id, nombre)
  WHERE deleted_at IS NULL;
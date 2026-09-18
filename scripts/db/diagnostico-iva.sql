-- P1-IVA — Diagnóstico NO destructivo de tratamientos fiscales inconsistentes.
--
-- Sólo lectura y sólo AGREGADOS: devuelve conteos por tipo de inconsistencia.
-- A propósito NO expone conceptos, facturas, clientes ni importes individuales.
-- No modifica ninguna fila y no infiere el tratamiento de registros históricos:
-- Contabilidad decide la regla antes de cualquier corrección.
--
-- Uso: psql "$DATABASE_URL" -f scripts/db/diagnostico-iva.sql

WITH v AS (
  SELECT 'conceptos_venta'::text AS tabla, tipo_iva, aplica_iva, tasa_iva_aplicada
  FROM public.conceptos_venta WHERE deleted_at IS NULL
  UNION ALL
  SELECT 'proforma_conceptos_consolidados', tipo_iva, aplica_iva, tasa_iva_aplicada
  FROM public.proforma_conceptos_consolidados WHERE deleted_at IS NULL
  UNION ALL
  SELECT 'conceptos_factura', tipo_iva, NULL::boolean, tasa_iva_aplicada
  FROM public.conceptos_factura WHERE deleted_at IS NULL
)
SELECT
  tabla,
  CASE
    -- Ajuste residual P1: un renglón sin tratamiento fiscal reconocido NUNCA
    -- se cuenta como coherente, sin importar tasa ni flag (no se infiere
    -- tasa 0% ni exento). Para timbrar es ambiguo y se bloquea.
    WHEN tipo_iva IS NULL
      THEN 'sin_tratamiento_fiscal_ambiguo'
    WHEN tipo_iva NOT IN ('gravado_16','gravado_8','tasa_0','exento','no_objeto')
      THEN 'tratamiento_desconocido_ambiguo'
    -- P2-IVA: cualquier tasa distinta de cero (incluidas negativas) es
    -- incoherente para un tratamiento que no causa IVA trasladado.
    WHEN tipo_iva IN ('exento','no_objeto','tasa_0') AND COALESCE(tasa_iva_aplicada, 0) <> 0
      THEN 'no_causante_con_tasa'

    WHEN tipo_iva IN ('gravado_16','gravado_8') AND aplica_iva IS FALSE
      THEN 'gravado_con_iva_apagado'
    WHEN tipo_iva IN ('gravado_16','gravado_8') AND tasa_iva_aplicada IS NULL
      THEN 'gravado_sin_tasa'
    WHEN tipo_iva = 'gravado_16' AND tasa_iva_aplicada IS NOT NULL AND tasa_iva_aplicada <> 0.16
      THEN 'gravado_16_con_otra_tasa'
    WHEN tipo_iva = 'gravado_8' AND tasa_iva_aplicada IS NOT NULL AND tasa_iva_aplicada <> 0.08
      THEN 'gravado_8_con_otra_tasa'
    ELSE 'coherente'
  END AS clasificacion,
  COUNT(*) AS filas
FROM v
GROUP BY 1, 2
ORDER BY 1, 3 DESC;

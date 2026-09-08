-- R220 · Los expedientes Cancelado/Borrador no deben derivarse a 'Arribo'.
-- El CASE de estado_real estimaba por ETD/ETA cuando el estado guardado no era
-- uno de los avanzados, así que un Cancelado con ETA vencida entraba a demoras
-- y a "activos" (el filtro NOT IN ('Cancelado') corre DESPUÉS de la derivación).

-- 1) Funciones de alerta: guard explícito en la rama de demora.
CREATE OR REPLACE FUNCTION public.sidebar_alert_counts()
 RETURNS TABLE(embarques_demora bigint, facturas_vencidas bigint, garantias_atoradas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL
       AND e.deleted_at IS NULL
       -- R220: Cancelado/Borrador nunca son demora.
       AND e.estado::text NOT IN ('Cancelado','Borrador')
       AND (current_date - e.eta) >= 7
       AND CASE
         WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
         WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
              AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
           CASE
             WHEN current_date < e.etd THEN 'Confirmado'
             WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
             WHEN current_date >= e.eta THEN 'Arribo'
             ELSE e.estado::text
           END
         ELSE e.estado::text
       END = 'Arribo'
       AND e.organization_id = public.org_scope()
    ) AS embarques_demora,
    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'
       AND f.deleted_at IS NULL
       AND f.organization_id = public.org_scope()
    ) AS facturas_vencidas,
    (SELECT count(*) FROM embarque_garantias_contenedor g
     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'
       AND g.deleted_at IS NULL
       AND e.deleted_at IS NULL
       AND g.fecha_deposito IS NOT NULL
       AND (current_date - g.fecha_deposito) > 30
       AND e.organization_id = public.org_scope()
    ) AS garantias_atoradas;
$function$;

CREATE OR REPLACE FUNCTION public.embarques_alertas_ids()
 RETURNS TABLE(embarque_id uuid, tipo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, 'demora'::text AS tipo
  FROM embarques e
  WHERE e.deleted_at IS NULL
    -- R220: Cancelado/Borrador nunca son demora.
    AND e.estado::text NOT IN ('Cancelado','Borrador')
    AND e.eta IS NOT NULL
    AND (current_date - e.eta) >= 7
    AND CASE
       WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
       WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
            AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
         CASE
           WHEN current_date < e.etd THEN 'Confirmado'
           WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
           WHEN current_date >= e.eta THEN 'Arribo'
           ELSE e.estado::text
         END
       ELSE e.estado::text
     END = 'Arribo'
    AND (e.organization_id = public.org_scope())

  UNION ALL

  SELECT DISTINCT e.id, 'garantia'::text
  FROM embarque_garantias_contenedor g
  JOIN embarques e ON e.id = g.embarque_id
  WHERE g.estado = 'depositado'
    AND g.fecha_deposito IS NOT NULL
    AND (current_date - g.fecha_deposito) > 30
    AND e.deleted_at IS NULL
    AND (e.organization_id = public.org_scope())

  UNION ALL

  SELECT e.id,
         CASE WHEN e.estado = 'Por liquidar' THEN 'admin_pendiente' ELSE 'cierre_operativo' END::text
  FROM embarques e
  WHERE e.deleted_at IS NULL
    AND e.estado IN ('Entregado', 'EIR', 'Por liquidar')
    AND (e.organization_id = public.org_scope())
    AND (
      EXISTS (
        SELECT 1 FROM facturas f
        WHERE f.embarque_id = e.id AND f.deleted_at IS NULL
          AND f.estado NOT IN ('Cancelada','Pagada')
        GROUP BY f.embarque_id
        HAVING SUM(f.total) > COALESCE((
          SELECT SUM(pf.monto) FROM pagos_factura pf
          JOIN facturas fi ON fi.id = pf.factura_id
          WHERE fi.embarque_id = e.id AND fi.deleted_at IS NULL
            AND fi.estado NOT IN ('Cancelada','Pagada')
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM proveedor_facturas pf
        WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        GROUP BY pf.embarque_id
        HAVING SUM(pf.total) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          JOIN proveedor_facturas pfx ON pfx.id = pp.proveedor_factura_id
          WHERE pfx.embarque_id = e.id AND pfx.deleted_at IS NULL AND pfx.estado <> 'Cancelada'
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM documentos_embarque de
        WHERE de.embarque_id = e.id AND de.deleted_at IS NULL
          AND (de.archivo IS NULL OR de.archivo = '')
          AND de.estado <> 'No aplica'
      )
      OR (
        COALESCE((SELECT SUM(total) FROM conceptos_venta WHERE embarque_id = e.id AND deleted_at IS NULL),0)
        > COALESCE((SELECT SUM(total) FROM facturas WHERE embarque_id = e.id AND deleted_at IS NULL AND estado <> 'Cancelada'),0) + 0.01
      )
    );
$function$;

-- 2) Funciones con estado_real materializado (dashboard_stats,
--    _dashboard_details_calc, _dashboard_summary_calc, operaciones_stats):
--    se preserva 'Cancelado' igual que ya se preserva 'Borrador'. El parche es
--    textual y puntual sobre la definición vigente para no reescribir cuerpos
--    de 200+ líneas; es idempotente (si el guard ya existe, no toca nada).
DO $do$
DECLARE
  v_fn text;
  v_def text;
  v_old text := 'WHEN e.estado IN (''Arribo'',''En Aduana'',''Entregado'',''EIR'',''Por liquidar'',''Cerrado'') THEN e.estado::text';
  v_new text := 'WHEN e.estado::text = ''Cancelado'' THEN ''Cancelado''' || E'\n          ' ||
                'WHEN e.estado IN (''Arribo'',''En Aduana'',''Entregado'',''EIR'',''Por liquidar'',''Cerrado'') THEN e.estado::text';
BEGIN
  FOREACH v_fn IN ARRAY ARRAY['dashboard_stats','_dashboard_details_calc','_dashboard_summary_calc','operaciones_stats']
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn
     LIMIT 1;

    IF v_def IS NULL THEN
      RAISE EXCEPTION 'R220: no se encontró public.%', v_fn;
    END IF;

    IF position('WHEN e.estado::text = ''Cancelado''' IN v_def) > 0 THEN
      CONTINUE; -- ya parcheada
    END IF;

    IF position(v_old IN v_def) = 0 THEN
      RAISE EXCEPTION 'R220: patrón de estado_real no encontrado en public.%', v_fn;
    END IF;

    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
  END LOOP;
END
$do$;
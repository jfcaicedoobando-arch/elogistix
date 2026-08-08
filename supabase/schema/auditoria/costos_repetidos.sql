-- Fuente canónica de la regla 'costos_repetidos' y del wrapper público de auditoría.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public._audit_costos_repetidos(p_organization_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  WITH emb AS (
    SELECT e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
    FROM embarques e
    WHERE e.organization_id = p_organization_id
      AND e.deleted_at IS NULL
      AND e.estado::text <> 'Cancelado'
  ),
  n_conts AS (
    SELECT ec.embarque_id, COUNT(*) AS n
    FROM embarque_contenedores ec
    WHERE ec.deleted_at IS NULL
      AND ec.embarque_id IN (SELECT id FROM emb)
    GROUP BY ec.embarque_id
  ),
  grupos AS (
    SELECT cc.embarque_id, cc.concepto, cc.monto, cc.moneda::text AS moneda, COUNT(*) AS copias
    FROM conceptos_costo cc
    WHERE cc.deleted_at IS NULL
      AND cc.embarque_id IN (SELECT id FROM emb)
    GROUP BY cc.embarque_id, cc.concepto, cc.monto, cc.moneda, COALESCE(cc.contenedor_id::text, '-')
    HAVING COUNT(*) > 1
  ),
  sospechosos AS (
    SELECT g.embarque_id, COUNT(*) AS n_grupos, SUM(g.copias - 1) AS n_extras
    FROM grupos g
    LEFT JOIN n_conts nc ON nc.embarque_id = g.embarque_id
    WHERE g.copias <> COALESCE(nc.n, 0)
    GROUP BY g.embarque_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'embarque_id', e.id, 'expediente', e.expediente,
    'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
    'regla', 'costos_repetidos', 'severidad', 'alto',
    'detalle', s.n_grupos || ' grupo(s) de costos idénticos repetidos (' || s.n_extras ||
               ' renglón(es) de más) que no corresponden al número de contenedores; revisa si son duplicados',
    'documentos_faltantes', '[]'::jsonb
  )), '[]'::jsonb)
  FROM sospechosos s
  JOIN emb e ON e.id = s.embarque_id;
$$;

-- Wrapper público: delega en la función base y suma la nueva regla.
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_base jsonb;
  v_extras jsonb;
BEGIN
  v_base := public._auditoria_embarques_org_base(p_organization_id);
  v_extras := public._audit_costos_repetidos(p_organization_id);

  IF v_extras IS NULL OR jsonb_array_length(v_extras) = 0 THEN
    RETURN v_base;
  END IF;

  RETURN public._audit_embarques_agregar(
    COALESCE(v_base->'hallazgos', '[]'::jsonb) || v_extras,
    COALESCE(v_base->'umbrales', '{}'::jsonb)
  );
END;
$function$;

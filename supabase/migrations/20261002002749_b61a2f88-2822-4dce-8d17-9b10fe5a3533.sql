CREATE TABLE public.crm_scoring_cortes (
  objeto text PRIMARY KEY CHECK (objeto IN ('empresa','oportunidad')),
  min_a integer NOT NULL CHECK (min_a BETWEEN 1 AND 100),
  min_b integer NOT NULL CHECK (min_b BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_b < min_a)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_scoring_cortes TO authenticated;
GRANT ALL ON public.crm_scoring_cortes TO service_role;
ALTER TABLE public.crm_scoring_cortes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.crm_scoring_reglas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objeto text NOT NULL CHECK (objeto IN ('empresa','oportunidad')),
  criterio text NOT NULL CHECK (length(trim(criterio)) > 0),
  fuente text NOT NULL CHECK (fuente IN ('propiedad','monto_usd','etapa','contacto_ligado','pricing_respondida')),
  propiedad_id uuid REFERENCES public.crm_propiedades(id) ON DELETE RESTRICT,
  opcion_id uuid REFERENCES public.crm_propiedad_opciones(id) ON DELETE RESTRICT,
  valor_texto text,
  min numeric,
  max numeric,
  puntos integer NOT NULL CHECK (puntos BETWEEN 0 AND 100),
  orden integer NOT NULL DEFAULT 0,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((fuente = 'propiedad') = (propiedad_id IS NOT NULL)),
  CHECK (fuente = 'propiedad' OR objeto = 'oportunidad'),
  CHECK (fuente <> 'etapa' OR nullif(trim(valor_texto), '') IS NOT NULL),
  CHECK (min IS NULL OR max IS NULL OR min < max)
);
CREATE INDEX crm_scoring_reglas_objeto_idx ON public.crm_scoring_reglas (objeto, criterio) WHERE activa;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_scoring_reglas TO authenticated;
GRANT ALL ON public.crm_scoring_reglas TO service_role;
ALTER TABLE public.crm_scoring_reglas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_scoring_cortes','crm_scoring_reglas'] LOOP
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
      public.has_role(auth.uid(), 'super_admin') OR EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = auth.uid()))$p$, t || '_leer', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'))$p$, t || '_crear', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'))$p$, t || '_editar', t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'))$p$, t || '_borrar', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t || '_updated_at', t);
  END LOOP;
END $$;

-- Sigue la cadena de renombres (reemplaza_a) hasta la opción vigente.
CREATE OR REPLACE FUNCTION public._crm_opcion_vigente(p_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v uuid := p_id; n uuid; i integer := 0;
BEGIN
  IF p_id IS NULL THEN RETURN NULL; END IF;
  LOOP
    n := NULL;
    SELECT o.id INTO n FROM crm_propiedad_opciones o WHERE o.reemplaza_a = v ORDER BY o.created_at DESC LIMIT 1;
    EXIT WHEN n IS NULL OR i >= 20;
    v := n; i := i + 1;
  END LOOP;
  RETURN v;
END $$;

-- Puntaje al momento (SECURITY INVOKER: sólo ve lo que RLS deja ver al usuario).
CREATE OR REPLACE FUNCTION public.crm_puntaje_detalle(p_objeto text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_org uuid; v_monto numeric; v_moneda text; v_etapa text; v_etapa_tipo text;
  v_usd numeric; v_eur numeric; v_total integer := 0; v_pts integer; v_letra text;
  v_desglose jsonb := '[]'::jsonb; c record;
BEGIN
  IF p_objeto = 'empresa' THEN
    SELECT e.organization_id INTO v_org FROM crm_empresas e WHERE e.id = p_id AND e.deleted_at IS NULL;
  ELSIF p_objeto = 'oportunidad' THEN
    SELECT o.organization_id, o.monto_estimado, o.moneda, e.nombre, e.tipo::text
      INTO v_org, v_monto, v_moneda, v_etapa, v_etapa_tipo
      FROM crm_oportunidades o LEFT JOIN crm_etapas_pipeline e ON e.id = o.etapa_id
     WHERE o.id = p_id AND o.deleted_at IS NULL;
  ELSE
    RAISE EXCEPTION 'LC_SCORING_OBJETO_INVALIDO';
  END IF;
  IF v_org IS NULL THEN RETURN NULL; END IF;
  IF v_etapa_tipo IN ('ganada','perdida') THEN
    RETURN jsonb_build_object('puntaje', NULL, 'letra', NULL, 'desglose', '[]'::jsonb, 'cerrada', true);
  END IF;
  IF v_monto IS NOT NULL AND coalesce(v_moneda, 'USD') <> 'USD' THEN
    SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM tipos_cambio_dof t WHERE t.usd_mxn > 0 ORDER BY t.fecha DESC LIMIT 1;
    v_monto := CASE
      WHEN v_moneda = 'MXN' AND v_usd > 0 THEN v_monto / v_usd
      WHEN v_moneda = 'EUR' AND v_usd > 0 AND v_eur > 0 THEN v_monto * v_eur / v_usd
      ELSE NULL END;
  END IF;

  FOR c IN SELECT r.criterio, max(r.puntos) AS maximo FROM crm_scoring_reglas r
            WHERE r.objeto = p_objeto AND r.activa GROUP BY r.criterio ORDER BY min(r.orden), r.criterio LOOP
    SELECT coalesce(max(g.puntos), 0) INTO v_pts
      FROM crm_scoring_reglas g
      LEFT JOIN crm_propiedades p ON p.id = g.propiedad_id
      LEFT JOIN crm_valores v ON v.propiedad_id = g.propiedad_id AND v.registro_id = p_id AND v.organization_id = v_org
     WHERE g.objeto = p_objeto AND g.activa AND g.criterio = c.criterio AND (
       (g.fuente = 'propiedad' AND v.id IS NOT NULL AND (CASE
          WHEN g.opcion_id IS NOT NULL THEN
            _crm_opcion_vigente(g.opcion_id) IN (SELECT _crm_opcion_vigente(x) FROM unnest(coalesce(v.opcion_ids, '{}'::uuid[])) x)
          WHEN p.tipo = 'numero' AND (g.min IS NOT NULL OR g.max IS NOT NULL) THEN
            v.valor_numero IS NOT NULL AND v.valor_numero >= coalesce(g.min, v.valor_numero) AND (g.max IS NULL OR v.valor_numero < g.max)
          ELSE
            nullif(trim(v.valor_texto), '') IS NOT NULL OR v.valor_numero IS NOT NULL OR v.valor_fecha IS NOT NULL
            OR coalesce(array_length(v.opcion_ids, 1), 0) > 0
        END))
       OR (g.fuente = 'monto_usd' AND v_monto IS NOT NULL AND v_monto >= coalesce(g.min, v_monto) AND (g.max IS NULL OR v_monto < g.max))
       OR (g.fuente = 'etapa' AND lower(v_etapa) = lower(trim(g.valor_texto)))
       OR (g.fuente = 'contacto_ligado' AND EXISTS (SELECT 1 FROM crm_oportunidad_contacto oc WHERE oc.oportunidad_id = p_id))
       OR (g.fuente = 'pricing_respondida' AND EXISTS (SELECT 1 FROM crm_solicitudes_pricing s
             WHERE s.oportunidad_id = p_id AND s.estado = 'respondida' AND s.deleted_at IS NULL))
     );
    v_total := v_total + v_pts;
    v_desglose := v_desglose || jsonb_build_array(jsonb_build_object('criterio', c.criterio, 'puntos', v_pts, 'maximo', c.maximo));
  END LOOP;

  v_total := least(v_total, 100);
  SELECT CASE WHEN v_total >= k.min_a THEN 'A' WHEN v_total >= k.min_b THEN 'B' ELSE 'C' END
    INTO v_letra FROM crm_scoring_cortes k WHERE k.objeto = p_objeto;
  v_letra := coalesce(v_letra, CASE WHEN v_total >= 80 THEN 'A' WHEN v_total >= 50 THEN 'B' ELSE 'C' END);
  RETURN jsonb_build_object('puntaje', v_total, 'letra', v_letra, 'desglose', v_desglose, 'cerrada', false);
END $$;

-- Lote para listas (máx. 500 ids por llamada).
CREATE OR REPLACE FUNCTION public.crm_puntajes(p_objeto text, p_ids uuid[])
RETURNS TABLE (id uuid, puntaje integer, letra text) LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT x, (d->>'puntaje')::integer, d->>'letra'
    FROM unnest(p_ids[1:500]) AS x
    CROSS JOIN LATERAL (SELECT public.crm_puntaje_detalle(p_objeto, x) AS d) l
   WHERE d IS NOT NULL;
$$;

-- Columnas calculadas para filtrar por letra en las listas.
CREATE OR REPLACE FUNCTION public.letra_crm(public.crm_empresas)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$ SELECT public.crm_puntaje_detalle('empresa', $1.id)->>'letra' $$;
CREATE OR REPLACE FUNCTION public.letra_crm(public.crm_oportunidades)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$ SELECT public.crm_puntaje_detalle('oportunidad', $1.id)->>'letra' $$;

REVOKE ALL ON FUNCTION public._crm_opcion_vigente(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_puntaje_detalle(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_puntajes(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.letra_crm(public.crm_empresas) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.letra_crm(public.crm_oportunidades) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_opcion_vigente(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_puntaje_detalle(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_puntajes(text, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.letra_crm(public.crm_empresas) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.letra_crm(public.crm_oportunidades) TO authenticated, service_role;

-- Criterios iniciales (editables por el súper administrador).
INSERT INTO public.crm_scoring_cortes (objeto, min_a, min_b) VALUES ('empresa', 80, 50), ('oportunidad', 80, 50);

INSERT INTO public.crm_scoring_reglas (objeto, criterio, fuente, propiedad_id, opcion_id, valor_texto, min, max, puntos, orden)
SELECT 'empresa', r.criterio, 'propiedad', p.id, o.id, NULL, r.min, r.max, r.puntos, r.orden
  FROM (VALUES
    ('Volumen de importación USD', 'volumen_importacion_usd', NULL::text, 1000000::numeric, NULL::numeric, 30, 1),
    ('Volumen de importación USD', 'volumen_importacion_usd', NULL, 250000, 1000000, 20, 1),
    ('Volumen de importación USD', 'volumen_importacion_usd', NULL, 0, 250000, 10, 1),
    ('Potencial mensual TEUs', 'potencial_mensual_teus', NULL, 10, NULL, 25, 2),
    ('Potencial mensual TEUs', 'potencial_mensual_teus', NULL, 3, 10, 15, 2),
    ('Potencial mensual TEUs', 'potencial_mensual_teus', NULL, 1, 3, 5, 2),
    ('Tipo de transporte', 'tipo_transporte', 'Marítimo', NULL, NULL, 15, 3),
    ('Tipo de transporte', 'tipo_transporte', 'Aéreo', NULL, NULL, 10, 3),
    ('Tipo de transporte', 'tipo_transporte', 'Terrestre', NULL, NULL, 5, 3),
    ('Agente aduanal o transportista propio', 'agente_propio', 'No', NULL, NULL, 15, 4),
    ('Agente aduanal o transportista propio', 'agente_propio', 'Sí', NULL, NULL, 5, 4),
    ('Perfil de crédito capturado', 'perfil_credito', NULL, NULL, NULL, 15, 5)
  ) AS r(criterio, clave, opcion, min, max, puntos, orden)
  JOIN public.crm_propiedades p ON p.objeto = 'empresa' AND p.clave = r.clave
  LEFT JOIN public.crm_propiedad_opciones o ON o.propiedad_id = p.id AND o.etiqueta = r.opcion AND NOT o.archivada
 WHERE r.opcion IS NULL OR o.id IS NOT NULL;

INSERT INTO public.crm_scoring_reglas (objeto, criterio, fuente, propiedad_id, opcion_id, valor_texto, min, max, puntos, orden)
SELECT 'oportunidad', 'Complejidad', 'propiedad', p.id, o.id, NULL, NULL, NULL, r.puntos, 3
  FROM (VALUES ('Estándar', 15), ('Especial', 10), ('Compleja', 5)) AS r(opcion, puntos)
  JOIN public.crm_propiedades p ON p.objeto = 'oportunidad' AND p.clave = 'complejidad'
  JOIN public.crm_propiedad_opciones o ON o.propiedad_id = p.id AND o.etiqueta = r.opcion AND NOT o.archivada;

INSERT INTO public.crm_scoring_reglas (objeto, criterio, fuente, valor_texto, min, max, puntos, orden) VALUES
  ('oportunidad', 'Monto estimado (USD)', 'monto_usd', NULL, 50000, NULL, 30, 1),
  ('oportunidad', 'Monto estimado (USD)', 'monto_usd', NULL, 10000, 50000, 20, 1),
  ('oportunidad', 'Monto estimado (USD)', 'monto_usd', NULL, 0.01, 10000, 10, 1),
  ('oportunidad', 'Etapa', 'etapa', 'Negociación', NULL, NULL, 25, 2),
  ('oportunidad', 'Etapa', 'etapa', 'Calificado', NULL, NULL, 15, 2),
  ('oportunidad', 'Etapa', 'etapa', 'Prospecto', NULL, NULL, 5, 2),
  ('oportunidad', 'Contacto ligado', 'contacto_ligado', NULL, NULL, NULL, 15, 4),
  ('oportunidad', 'Solicitud a Pricing respondida', 'pricing_respondida', NULL, NULL, NULL, 15, 5);
-- Respuesta de pricing = tarifa del catálogo + folio mensual MMMYY0001.

-- 1) Campos nuevos en tarifas (aditivos).
ALTER TABLE public.costeo_tarifas
  ADD COLUMN IF NOT EXISTS solicitud_pricing_id uuid REFERENCES public.crm_solicitudes_pricing(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS carta_garantia boolean,
  ADD COLUMN IF NOT EXISTS unidad_flete text;
CREATE INDEX IF NOT EXISTS costeo_tarifas_solicitud_pricing_idx
  ON public.costeo_tarifas(solicitud_pricing_id) WHERE solicitud_pricing_id IS NOT NULL;

-- La solicitud ligada debe ser de la misma organización, estar enviada y el vínculo no cambia.
CREATE OR REPLACE FUNCTION public._costeo_tarifa_solicitud_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_estado text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.solicitud_pricing_id IS DISTINCT FROM OLD.solicitud_pricing_id THEN
    RAISE EXCEPTION 'LC_TARIFA_SOLICITUD_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.solicitud_pricing_id IS NOT NULL THEN
    SELECT organization_id, estado INTO v_org, v_estado
      FROM public.crm_solicitudes_pricing WHERE id = NEW.solicitud_pricing_id AND deleted_at IS NULL;
    IF v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
    END IF;
    IF v_estado <> 'enviada' THEN
      RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public._crm_es_pricing(v_org) THEN
      RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_costeo_tarifa_solicitud_guard ON public.costeo_tarifas;
CREATE TRIGGER trg_costeo_tarifa_solicitud_guard BEFORE INSERT OR UPDATE ON public.costeo_tarifas
  FOR EACH ROW EXECUTE FUNCTION public._costeo_tarifa_solicitud_guard();

-- 2) Alta de tarifa acepta los campos nuevos en la misma transacción.
CREATE OR REPLACE FUNCTION public.crear_tarifa_con_recargos_rpc(p_organization_id uuid, p_tarifa jsonb, p_recargos jsonb)
 RETURNS costeo_tarifas
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.costeo_tarifas;
BEGIN
  INSERT INTO public.costeo_tarifas (
    organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    flete_base, dias_libres_demoras, vigente_desde, vigente_hasta,
    transit_time_dias, notas, moneda, estado,
    solicitud_pricing_id, carta_garantia, unidad_flete
  ) VALUES (
    p_organization_id,
    NULLIF(p_tarifa->>'agente_id', '')::uuid,
    NULLIF(p_tarifa->>'naviera_id', '')::uuid,
    NULLIF(p_tarifa->>'ruta_id', '')::uuid,
    NULLIF(p_tarifa->>'tipo_contenedor_id', '')::uuid,
    NULLIF(p_tarifa->>'flete_base', '')::numeric,
    COALESCE(NULLIF(p_tarifa->>'dias_libres_demoras', '')::integer, 0),
    NULLIF(p_tarifa->>'vigente_desde', '')::date,
    NULLIF(p_tarifa->>'vigente_hasta', '')::date,
    NULLIF(p_tarifa->>'transit_time_dias', '')::integer,
    NULLIF(p_tarifa->>'notas', ''),
    'USD',
    'vigente',
    NULLIF(p_tarifa->>'solicitud_pricing_id', '')::uuid,
    NULLIF(p_tarifa->>'carta_garantia', '')::boolean,
    NULLIF(btrim(COALESCE(p_tarifa->>'unidad_flete', '')), '')
  )
  RETURNING * INTO v_row;

  INSERT INTO public.costeo_tarifa_recargos (
    tarifa_id, organization_id, concepto, lado, monto, moneda, incluido_en_total
  )
  SELECT
    v_row.id,
    v_row.organization_id,
    btrim(r->>'concepto'),
    COALESCE(NULLIF(r->>'lado', ''), 'origen'),
    (r->>'monto')::numeric,
    'USD',
    COALESCE((r->>'incluido_en_total')::boolean, true)
  FROM jsonb_array_elements(COALESCE(p_recargos, '[]'::jsonb)) AS r
  WHERE NULLIF(btrim(COALESCE(r->>'concepto', '')), '') IS NOT NULL
    AND COALESCE((r->>'monto')::numeric, 0) > 0;

  RETURN v_row;
END;
$function$;

-- 3) Folio mensual: MES(3) + AÑO(2) + consecutivo(4), reinicia cada mes (hora de CDMX).
CREATE OR REPLACE FUNCTION public._crm_folio_pricing_prefijo(p_ts timestamptz) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (ARRAY['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'])
           [extract(month FROM p_ts AT TIME ZONE 'America/Mexico_City')::int]
         || to_char(p_ts AT TIME ZONE 'America/Mexico_City', 'YY')
$$;

CREATE OR REPLACE FUNCTION public._crm_sol_pricing_before_ins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_num bigint; v_tipo text;
BEGIN
  SELECT organization_id INTO v_org FROM public.crm_oportunidades WHERE id = NEW.oportunidad_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'LC_PRICING_OPORTUNIDAD_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.solicitante_id AND organization_id = v_org) THEN
    RAISE EXCEPTION 'LC_PRICING_SOLICITANTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  v_tipo := 'pricing_' || to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYMM');
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero) VALUES (v_org, v_tipo, 1)
  ON CONFLICT (organization_id, tipo) DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1, updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  NEW.folio := public._crm_folio_pricing_prefijo(now()) || lpad(v_num::text, 4, '0');
  NEW.created_by := auth.uid();
  NEW.estado := 'borrador';
  NEW.enviada_at := NULL; NEW.vence_at := NULL; NEW.respondida_at := NULL;
  RETURN NEW;
END $$;

-- 4) Renumerar folios viejos (SEP0081…) por orden de alta dentro de su mes.
CREATE TEMP TABLE _folios_pricing ON COMMIT DROP AS
SELECT id, organization_id, folio AS viejo,
       public._crm_folio_pricing_prefijo(created_at)
         || lpad(row_number() OVER (PARTITION BY organization_id,
              to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYMM') ORDER BY created_at, id)::text, 4, '0') AS nuevo,
       'pricing_' || to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYMM') AS tipo
FROM public.crm_solicitudes_pricing
WHERE folio ~ '^SEP[0-9]{4}$';

ALTER TABLE public.crm_solicitudes_pricing DISABLE TRIGGER trg_crm_sol_pricing_upd;
UPDATE public.crm_solicitudes_pricing s SET folio = f.nuevo FROM _folios_pricing f WHERE s.id = f.id;
ALTER TABLE public.crm_solicitudes_pricing ENABLE TRIGGER trg_crm_sol_pricing_upd;

UPDATE public.notificaciones_internas n SET titulo = replace(n.titulo, f.viejo, f.nuevo)
FROM _folios_pricing f
WHERE n.entidad_tipo = 'crm_solicitud_pricing' AND n.entidad_id = f.id AND n.titulo LIKE '%' || f.viejo;

INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT organization_id, tipo, count(*) FROM _folios_pricing GROUP BY organization_id, tipo
ON CONFLICT (organization_id, tipo) DO UPDATE
  SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero), updated_at = now();

-- 5) Responder exige al menos una tarifa ligada (o una opción capturada antes del cambio).
CREATE OR REPLACE FUNCTION public.crm_responder_solicitud_pricing(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public._crm_es_pricing(v.organization_id) THEN RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501'; END IF;
  IF v.estado = 'respondida' THEN RETURN jsonb_build_object('id', v.id, 'ya_respondida', true); END IF;
  IF v.estado <> 'enviada' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.costeo_tarifas WHERE solicitud_pricing_id = p_id)
     AND NOT EXISTS (SELECT 1 FROM public.crm_pricing_opciones WHERE solicitud_id = p_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_OPCIONES' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing SET estado = 'respondida', respondida_at = now() WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  VALUES (v.organization_id, v.solicitante_id, 'crm_pricing_respuesta', 'Pricing respondió ' || v.folio,
          'Ya hay opciones de tarifa para ' || coalesce(v.cliente, 'tu solicitud'),
          '/crm/oportunidades/' || v.oportunidad_id, 'crm_solicitud_pricing', v.id);
  RETURN jsonb_build_object('id', v.id, 'ya_respondida', false);
END $function$;

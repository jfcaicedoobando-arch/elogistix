ALTER TABLE public.crm_contactos ADD COLUMN puesto text, ADD COLUMN telefono_fijo text;

CREATE TABLE public.crm_broker_solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  broker_id uuid NOT NULL REFERENCES public.crm_brokers(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.crm_empresas(id) ON DELETE RESTRICT,
  rol_contacto text NOT NULL CHECK (length(btrim(rol_contacto)) > 0),
  relacion text NOT NULL CHECK (length(btrim(relacion)) > 0),
  tiempo_cierre text NOT NULL CHECK (length(btrim(tiempo_cierre)) > 0),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','autorizada','rechazada')),
  motivo text,
  resuelto_por uuid,
  resuelto_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_broker_solicitudes_pendiente_uq
  ON public.crm_broker_solicitudes (broker_id, empresa_id) WHERE estado = 'pendiente';
CREATE INDEX crm_broker_solicitudes_org_idx ON public.crm_broker_solicitudes (organization_id, estado);

GRANT SELECT ON public.crm_broker_solicitudes TO authenticated;
GRANT ALL ON public.crm_broker_solicitudes TO service_role;
ALTER TABLE public.crm_broker_solicitudes ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_broker_solicitudes_select ON public.crm_broker_solicitudes FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.crm_brokers b WHERE b.id = broker_id AND b.user_id = (SELECT auth.uid()))
  OR public.has_any_role_in_org((SELECT auth.uid()), ARRAY['admin_org','gerente_comercial','vendedor']::public.app_role[], organization_id)
);

-- Broker activo del usuario actual (bloqueado).
CREATE FUNCTION public._broker_actual(p_broker_id uuid)
RETURNS public.crm_brokers LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.crm_brokers%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.crm_brokers
   WHERE id = p_broker_id AND user_id = auth.uid() AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_BROKER_NO_AUTORIZADO' USING ERRCODE = '42501'; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public._broker_actual(uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.broker_mis_organizaciones()
RETURNS TABLE (broker_id uuid, organizacion text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT b.id, o.nombre FROM public.crm_brokers b
    JOIN public.organizations o ON o.id = b.organization_id AND o.activo IS TRUE
   WHERE b.user_id = auth.uid() AND b.activo ORDER BY o.nombre LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.broker_mis_organizaciones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_mis_organizaciones() TO authenticated;

-- Búsqueda discreta: sólo nombre y si es Cliente o Prospecto (con etapa).
CREATE FUNCTION public.broker_buscar_empresa(p_broker_id uuid, p_texto text)
RETURNS TABLE (empresa_id uuid, nombre text, tipo text, etapa text, es_mia boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.crm_brokers%ROWTYPE; v_q text := btrim(coalesce(p_texto, ''));
BEGIN
  SELECT * INTO v FROM public.crm_brokers WHERE id = p_broker_id AND user_id = auth.uid() AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_BROKER_NO_AUTORIZADO' USING ERRCODE = '42501'; END IF;
  IF length(v_q) < 3 THEN RETURN; END IF;
  RETURN QUERY
  SELECT e.id, e.nombre,
         CASE WHEN e.estado_crm = 'Cliente' OR e.cliente_id IS NOT NULL THEN 'Cliente' ELSE 'Prospecto' END,
         CASE WHEN e.estado_crm = 'Cliente' OR e.cliente_id IS NOT NULL THEN NULL ELSE (
           SELECT ep.nombre FROM public.crm_oportunidad_empresa oe
             JOIN public.crm_oportunidades op ON op.id = oe.oportunidad_id AND op.deleted_at IS NULL
             JOIN public.crm_etapas_pipeline ep ON ep.id = op.etapa_id
            WHERE oe.empresa_id = e.id ORDER BY op.updated_at DESC LIMIT 1) END,
         e.broker_id IS NOT DISTINCT FROM v.id
    FROM public.crm_empresas e
   WHERE e.organization_id = v.organization_id AND e.deleted_at IS NULL
     AND e.nombre ILIKE '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
   ORDER BY e.nombre LIMIT 10;
END $$;
REVOKE ALL ON FUNCTION public.broker_buscar_empresa(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_buscar_empresa(uuid, text) TO authenticated;

CREATE FUNCTION public.broker_solicitar_empresa(p_broker_id uuid, p_empresa_id uuid,
  p_rol_contacto text, p_relacion text, p_tiempo_cierre text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v public.crm_brokers%ROWTYPE; e public.crm_empresas%ROWTYPE; v_id uuid;
BEGIN
  v := public._broker_actual(p_broker_id);
  SELECT * INTO e FROM public.crm_empresas
   WHERE id = p_empresa_id AND organization_id = v.organization_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LC_CRM_EMPRESA_NO_ENCONTRADA' USING ERRCODE = 'P0002'; END IF;
  IF e.estado_crm = 'Cliente' OR e.cliente_id IS NOT NULL THEN RAISE EXCEPTION 'LC_BROKER_EMPRESA_ES_CLIENTE'; END IF;
  IF e.broker_id IS NOT NULL THEN RAISE EXCEPTION 'LC_BROKER_EMPRESA_YA_ASIGNADA'; END IF;
  IF EXISTS (SELECT 1 FROM public.crm_broker_solicitudes WHERE broker_id = v.id AND empresa_id = e.id AND estado = 'pendiente') THEN
    RAISE EXCEPTION 'LC_BROKER_SOLICITUD_PENDIENTE';
  END IF;
  INSERT INTO public.crm_broker_solicitudes (organization_id, broker_id, empresa_id, rol_contacto, relacion, tiempo_cierre)
  VALUES (v.organization_id, v.id, e.id, btrim(p_rol_contacto), btrim(p_relacion), btrim(p_tiempo_cierre))
  RETURNING id INTO v_id;
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT v.organization_id, u.uid, 'broker_solicitud', 'Solicitud de broker',
         v.nombre || ' pide trabajar la empresa ' || e.nombre || '.', '/crm/brokers/solicitudes', 'crm_broker_solicitud', v_id
    FROM (
      SELECT om.user_id AS uid FROM public.organization_members om
       WHERE om.organization_id = v.organization_id AND om.role::text IN ('admin_org','gerente_comercial')
      UNION
      SELECT op.vendedor_id FROM public.crm_oportunidad_empresa oe
        JOIN public.crm_oportunidades op ON op.id = oe.oportunidad_id AND op.deleted_at IS NULL
       WHERE oe.empresa_id = e.id AND op.vendedor_id IS NOT NULL
    ) u;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.broker_solicitar_empresa(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_solicitar_empresa(uuid, uuid, text, text, text) TO authenticated;

CREATE FUNCTION public.crm_broker_resolver_solicitud(p_id uuid, p_autorizar boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.crm_broker_solicitudes%ROWTYPE; b public.crm_brokers%ROWTYPE; v_nombre text;
BEGIN
  SELECT * INTO s FROM public.crm_broker_solicitudes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR s.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_BROKER_SOLICITUD_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.has_any_role_in_org(auth.uid(), ARRAY['admin_org','gerente_comercial']::public.app_role[], s.organization_id)
    OR EXISTS (SELECT 1 FROM public.crm_oportunidad_empresa oe
      JOIN public.crm_oportunidades op ON op.id = oe.oportunidad_id AND op.deleted_at IS NULL
     WHERE oe.empresa_id = s.empresa_id AND op.vendedor_id = auth.uid())) THEN
    RAISE EXCEPTION 'LC_BROKER_RESOLVER_NO_AUTORIZADO' USING ERRCODE = '42501';
  END IF;
  IF s.estado <> 'pendiente' THEN RAISE EXCEPTION 'LC_BROKER_SOLICITUD_YA_RESUELTA'; END IF;
  IF NOT p_autorizar AND length(btrim(coalesce(p_motivo, ''))) = 0 THEN RAISE EXCEPTION 'LC_BROKER_MOTIVO_REQUERIDO'; END IF;
  SELECT * INTO b FROM public.crm_brokers WHERE id = s.broker_id;
  IF p_autorizar THEN
    UPDATE public.crm_empresas SET broker_id = s.broker_id
     WHERE id = s.empresa_id AND broker_id IS NULL AND deleted_at IS NULL
       AND estado_crm <> 'Cliente' AND cliente_id IS NULL
    RETURNING nombre INTO v_nombre;
    IF v_nombre IS NULL THEN RAISE EXCEPTION 'LC_BROKER_EMPRESA_YA_ASIGNADA'; END IF;
    UPDATE public.crm_broker_solicitudes SET estado = 'rechazada', motivo = 'Otro broker fue autorizado',
           resuelto_por = auth.uid(), resuelto_at = now()
     WHERE empresa_id = s.empresa_id AND estado = 'pendiente' AND id <> s.id;
  ELSE
    SELECT nombre INTO v_nombre FROM public.crm_empresas WHERE id = s.empresa_id;
  END IF;
  UPDATE public.crm_broker_solicitudes
     SET estado = CASE WHEN p_autorizar THEN 'autorizada' ELSE 'rechazada' END,
         motivo = nullif(btrim(coalesce(p_motivo, '')), ''), resuelto_por = auth.uid(), resuelto_at = now()
   WHERE id = s.id;
  IF b.user_id IS NOT NULL THEN
    INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
    VALUES (s.organization_id, b.user_id, 'broker_solicitud',
            CASE WHEN p_autorizar THEN 'Solicitud autorizada' ELSE 'Solicitud rechazada' END,
            'Tu solicitud para ' || v_nombre || CASE WHEN p_autorizar THEN ' fue autorizada.' ELSE ' fue rechazada: ' || btrim(p_motivo) END,
            '/broker', 'crm_broker_solicitud', s.id);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.crm_broker_resolver_solicitud(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_broker_resolver_solicitud(uuid, boolean, text) TO authenticated;

-- Alta atómica de prospecto externo + KAM por turno rotativo.
CREATE FUNCTION public.broker_alta_prospecto(p_broker_id uuid, p_empresa jsonb, p_contactos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v public.crm_brokers%ROWTYPE;
  v_nombre text := btrim(coalesce(p_empresa->>'nombre', ''));
  v_kam uuid; v_kam_email text; v_etapa uuid; v_lead uuid; v_emp uuid; v_op uuid; v_cont uuid; c jsonb;
  v_notas text;
BEGIN
  v := public._broker_actual(p_broker_id);
  IF length(v_nombre) < 2 THEN RAISE EXCEPTION 'LC_BROKER_NOMBRE_REQUERIDO'; END IF;
  IF jsonb_typeof(coalesce(p_contactos, '[]'::jsonb)) <> 'array' OR jsonb_array_length(coalesce(p_contactos, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'LC_BROKER_CONTACTO_REQUERIDO';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('broker_alta:' || v.organization_id::text, 0));
  IF EXISTS (SELECT 1 FROM public.crm_empresas WHERE organization_id = v.organization_id
              AND deleted_at IS NULL AND lower(btrim(nombre)) = lower(v_nombre)) THEN
    RAISE EXCEPTION 'LC_BROKER_EMPRESA_EXISTE';
  END IF;
  SELECT id INTO v_etapa FROM public.crm_etapas_pipeline
   WHERE organization_id = v.organization_id AND nombre = 'Prospecto' AND deleted_at IS NULL ORDER BY orden LIMIT 1;
  IF v_etapa IS NULL THEN RAISE EXCEPTION 'LC_CRM_ETAPA_PROSPECTO_FALTANTE'; END IF;

  -- Turno rotativo: el KAM que hace más tiempo no recibe un prospecto de broker.
  SELECT om.user_id INTO v_kam FROM public.organization_members om
   WHERE om.organization_id = v.organization_id AND om.role::text = 'vendedor'
   ORDER BY (SELECT max(op.created_at) FROM public.crm_oportunidades op
               JOIN public.crm_leads l ON l.id = op.lead_id AND l.fuente::text = 'Broker'
              WHERE op.organization_id = v.organization_id AND op.vendedor_id = om.user_id) ASC NULLS FIRST,
            om.user_id
   LIMIT 1;
  IF v_kam IS NULL THEN RAISE EXCEPTION 'LC_BROKER_SIN_KAM'; END IF;
  SELECT email INTO v_kam_email FROM auth.users WHERE id = v_kam;

  v_notas := concat_ws(E'\n', 'Prospecto externo · Broker: ' || v.nombre,
    nullif('Transporte: ' || coalesce(p_empresa->>'transporte', ''), 'Transporte: '),
    nullif('Agente aduanal/transportista propio: ' || coalesce(p_empresa->>'agente_propio', ''), 'Agente aduanal/transportista propio: '),
    nullif(btrim(coalesce(p_empresa->>'notas', '')), ''));

  INSERT INTO public.crm_leads (organization_id, empresa, estado, fuente, vendedor_id, vendedor_email, created_by,
    pais, interes_modo, volumen, rutas, rfc, sector, origen, destino, incoterm, proveedor_actual, notas)
  VALUES (v.organization_id, v_nombre, 'Prospecto', 'Broker', v_kam, coalesce(v_kam_email, ''), auth.uid(),
    coalesce(p_empresa->>'pais', ''), coalesce(p_empresa->>'transporte', ''), p_empresa->>'volumen_usd',
    p_empresa->>'rutas', upper(coalesce(p_empresa->>'rfc', '')), p_empresa->>'sector', p_empresa->>'origen',
    p_empresa->>'destino', p_empresa->>'incoterm', p_empresa->>'proveedor_actual', v_notas)
  RETURNING id INTO v_lead;

  INSERT INTO public.crm_empresas (organization_id, nombre, lead_origen_id, estado_crm, broker_id, created_by)
  VALUES (v.organization_id, v_nombre, v_lead, 'Prospecto', v.id, auth.uid()) RETURNING id INTO v_emp;

  INSERT INTO public.crm_oportunidades (organization_id, nombre, cliente_nombre, lead_id, etapa_id, vendedor_id,
    vendedor_email, created_by, origen, destino, incoterm, proveedor_actual, sector, rutas, volumen, modo, notas)
  VALUES (v.organization_id, v_nombre, v_nombre, v_lead, v_etapa, v_kam, coalesce(v_kam_email, ''), auth.uid(),
    coalesce(p_empresa->>'origen', ''), coalesce(p_empresa->>'destino', ''), p_empresa->>'incoterm',
    p_empresa->>'proveedor_actual', p_empresa->>'sector', p_empresa->>'rutas', p_empresa->>'volumen_usd',
    coalesce(p_empresa->>'transporte', ''), v_notas)
  RETURNING id INTO v_op;
  INSERT INTO public.crm_oportunidad_empresa (organization_id, oportunidad_id, empresa_id) VALUES (v.organization_id, v_op, v_emp);

  FOR c IN SELECT * FROM jsonb_array_elements(p_contactos) LOOP
    IF length(btrim(coalesce(c->>'nombre', ''))) = 0 THEN RAISE EXCEPTION 'LC_BROKER_CONTACTO_REQUERIDO'; END IF;
    INSERT INTO public.crm_contactos (organization_id, nombre, email, telefono, telefono_fijo, puesto, lead_origen_id, created_by)
    VALUES (v.organization_id, btrim(c->>'nombre'), nullif(btrim(coalesce(c->>'email', '')), ''),
      nullif(btrim(coalesce(c->>'movil', '')), ''), nullif(btrim(coalesce(c->>'fijo', '')), ''),
      nullif(btrim(coalesce(c->>'puesto', '')), ''), v_lead, auth.uid())
    RETURNING id INTO v_cont;
    INSERT INTO public.crm_empresa_contacto (organization_id, empresa_id, contacto_id) VALUES (v.organization_id, v_emp, v_cont);
  END LOOP;

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  VALUES (v.organization_id, v_kam, 'broker_prospecto', 'Nuevo prospecto externo',
          v.nombre || ' registró la empresa ' || v_nombre || ' y te tocó por turno.', '/crm/oportunidades/' || v_op,
          'crm_oportunidad', v_op);
  RETURN jsonb_build_object('empresa_id', v_emp, 'oportunidad_id', v_op);
END $$;
REVOKE ALL ON FUNCTION public.broker_alta_prospecto(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broker_alta_prospecto(uuid, jsonb, jsonb) TO authenticated;
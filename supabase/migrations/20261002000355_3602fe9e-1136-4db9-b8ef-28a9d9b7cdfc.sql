CREATE OR REPLACE FUNCTION public._crm_es_pricing(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin') OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.organization_id = p_org
      AND om.role IN ('ejecutivo_pricing','admin_org','admin'));
$$;
REVOKE ALL ON FUNCTION public._crm_es_pricing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._crm_es_pricing(uuid) TO authenticated, service_role;

CREATE TABLE public.crm_solicitudes_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  oportunidad_id uuid NOT NULL REFERENCES public.crm_oportunidades(id) ON DELETE RESTRICT,
  folio text NOT NULL,
  solicitante_id uuid NOT NULL,
  fecha date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Mexico_City')::date,
  cliente text,
  servicio text CHECK (servicio IN ('Marítimo','Terrestre','Aéreo')),
  imo boolean,
  commodity text,
  container_size text,
  tipo_carga text,
  cantidad integer CHECK (cantidad IS NULL OR cantidad > 0),
  estibable boolean,
  peso text,
  dimensiones text,
  incoterm text CHECK (incoterm IN ('EXW','FAS','FCA','FOB','CFR','CIF','DAP','DDP','DPU')),
  pol text, pod text, origen text, destino text,
  fecha_tentativa_carga date,
  delivery text,
  notas text,
  complejidad text NOT NULL DEFAULT 'media' CHECK (complejidad IN ('baja','media','alta')),
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','enviada','respondida','cancelada')),
  enviada_at timestamptz, vence_at timestamptz, respondida_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (organization_id, folio)
);
CREATE INDEX crm_solicitudes_pricing_op_idx ON public.crm_solicitudes_pricing(oportunidad_id);
CREATE INDEX crm_solicitudes_pricing_estado_idx ON public.crm_solicitudes_pricing(organization_id, estado);
GRANT SELECT, INSERT, UPDATE ON public.crm_solicitudes_pricing TO authenticated;
GRANT ALL ON public.crm_solicitudes_pricing TO service_role;
ALTER TABLE public.crm_solicitudes_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_sol_pricing_leer ON public.crm_solicitudes_pricing FOR SELECT TO authenticated
  USING (organization_id = public.org_scope());
CREATE POLICY crm_sol_pricing_crear ON public.crm_solicitudes_pricing FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.org_scope() AND estado = 'borrador');
CREATE POLICY crm_sol_pricing_editar ON public.crm_solicitudes_pricing FOR UPDATE TO authenticated
  USING (organization_id = public.org_scope() AND (
    (estado = 'borrador' AND created_by = auth.uid()) OR public._crm_es_pricing(organization_id)))
  WITH CHECK (organization_id = public.org_scope());

CREATE TABLE public.crm_pricing_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  solicitud_id uuid NOT NULL REFERENCES public.crm_solicitudes_pricing(id) ON DELETE RESTRICT,
  orden integer NOT NULL DEFAULT 1,
  tarifa_id uuid REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  agente text,
  naviera_id uuid REFERENCES public.navieras(id) ON DELETE RESTRICT,
  carta_garantia boolean,
  transito text,
  ruta text,
  of_tarifa numeric(14,2), of_moneda text CHECK (of_moneda IN ('USD','MXN','EUR')), of_unidad text,
  origen_tarifa numeric(14,2), origen_moneda text CHECK (origen_moneda IN ('USD','MXN','EUR')), origen_unidad text,
  recoleccion_tarifa numeric(14,2), recoleccion_moneda text CHECK (recoleccion_moneda IN ('USD','MXN','EUR')), recoleccion_unidad text,
  otros_concepto text,
  otros_tarifa numeric(14,2), otros_moneda text CHECK (otros_moneda IN ('USD','MXN','EUR')), otros_unidad text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_pricing_opciones_sol_idx ON public.crm_pricing_opciones(solicitud_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pricing_opciones TO authenticated;
GRANT ALL ON public.crm_pricing_opciones TO service_role;
ALTER TABLE public.crm_pricing_opciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_pricing_op_leer ON public.crm_pricing_opciones FOR SELECT TO authenticated
  USING (organization_id = public.org_scope());
CREATE POLICY crm_pricing_op_escribir ON public.crm_pricing_opciones FOR ALL TO authenticated
  USING (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id))
  WITH CHECK (organization_id = public.org_scope() AND public._crm_es_pricing(organization_id));

-- Alta: org desde la oportunidad, folio SEP consecutivo, autoría.
CREATE OR REPLACE FUNCTION public._crm_sol_pricing_before_ins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_num bigint;
BEGIN
  SELECT organization_id INTO v_org FROM public.crm_oportunidades WHERE id = NEW.oportunidad_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'LC_PRICING_OPORTUNIDAD_INVALIDA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = NEW.solicitante_id AND organization_id = v_org) THEN
    RAISE EXCEPTION 'LC_PRICING_SOLICITANTE_INVALIDO' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero) VALUES (v_org, 'pricing', 1)
  ON CONFLICT (organization_id, tipo) DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1, updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  NEW.folio := 'SEP' || lpad(v_num::text, 4, '0');
  NEW.created_by := auth.uid();
  NEW.estado := 'borrador';
  NEW.enviada_at := NULL; NEW.vence_at := NULL; NEW.respondida_at := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_sol_pricing_ins BEFORE INSERT ON public.crm_solicitudes_pricing
  FOR EACH ROW EXECUTE FUNCTION public._crm_sol_pricing_before_ins();

-- Edición: folio/org/oportunidad inmutables; estado y reloj sólo por RPC.
CREATE OR REPLACE FUNCTION public._crm_sol_pricing_before_upd() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.folio <> OLD.folio OR NEW.organization_id <> OLD.organization_id
     OR NEW.oportunidad_id <> OLD.oportunidad_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'LC_PRICING_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(current_setting('lc.pricing_rpc', true), '') <> '1' AND (
     NEW.estado IS DISTINCT FROM OLD.estado OR NEW.enviada_at IS DISTINCT FROM OLD.enviada_at
     OR NEW.vence_at IS DISTINCT FROM OLD.vence_at OR NEW.respondida_at IS DISTINCT FROM OLD.respondida_at) THEN
    RAISE EXCEPTION 'LC_PRICING_ESTADO_SOLO_RPC' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_sol_pricing_upd BEFORE UPDATE ON public.crm_solicitudes_pricing
  FOR EACH ROW EXECUTE FUNCTION public._crm_sol_pricing_before_upd();

-- Opciones: org desde la solicitud; sólo mientras está enviada.
CREATE OR REPLACE FUNCTION public._crm_pricing_opcion_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sol record;
BEGIN
  SELECT organization_id, estado INTO v_sol FROM public.crm_solicitudes_pricing
   WHERE id = coalesce(NEW.solicitud_id, OLD.solicitud_id);
  IF v_sol.estado IS DISTINCT FROM 'enviada' THEN
    RAISE EXCEPTION 'LC_PRICING_NO_EDITABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF TG_OP = 'UPDATE' AND NEW.solicitud_id <> OLD.solicitud_id THEN
    RAISE EXCEPTION 'LC_PRICING_INMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.organization_id <> v_sol.organization_id THEN
    RAISE EXCEPTION 'LC_PRICING_ORG' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_pricing_opcion_guard BEFORE INSERT OR UPDATE OR DELETE ON public.crm_pricing_opciones
  FOR EACH ROW EXECUTE FUNCTION public._crm_pricing_opcion_guard();

-- Enviar: fija reloj y avisa a Pricing. Idempotente si ya está enviada.
CREATE OR REPLACE FUNCTION public.crm_enviar_solicitud_pricing(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_horas int;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v.estado = 'enviada' THEN RETURN jsonb_build_object('id', v.id, 'vence_at', v.vence_at, 'ya_enviada', true); END IF;
  IF v.estado <> 'borrador' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF v.created_by IS DISTINCT FROM auth.uid() AND NOT public._crm_es_pricing(v.organization_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;
  IF v.servicio IS NULL OR coalesce(trim(v.origen), trim(v.pol), '') = '' OR coalesce(trim(v.destino), trim(v.pod), '') = '' THEN
    RAISE EXCEPTION 'LC_PRICING_INCOMPLETA' USING ERRCODE = 'P0001';
  END IF;
  v_horas := CASE v.complejidad WHEN 'baja' THEN 8 WHEN 'alta' THEN 48 ELSE 24 END;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing SET estado = 'enviada', enviada_at = now(),
    vence_at = now() + make_interval(hours => v_horas) WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v.organization_id, om.user_id, 'crm_pricing_solicitud', 'Nueva solicitud de pricing ' || v.folio,
         coalesce(v.cliente, 'Sin cliente') || ' · ' || coalesce(v.origen, v.pol, '') || ' → ' || coalesce(v.destino, v.pod, '')
           || ' · responder en ' || v_horas || ' h',
         '/crm/pricing?id=' || v.id, 'crm_solicitud_pricing', v.id
    FROM public.organization_members om
   WHERE om.organization_id = v.organization_id AND om.role = 'ejecutivo_pricing';
  RETURN jsonb_build_object('id', v.id, 'ya_enviada', false);
END $$;

-- Responder: exige ≥1 opción, detiene reloj y avisa al solicitante.
CREATE OR REPLACE FUNCTION public.crm_responder_solicitud_pricing(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public._crm_es_pricing(v.organization_id) THEN RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501'; END IF;
  IF v.estado = 'respondida' THEN RETURN jsonb_build_object('id', v.id, 'ya_respondida', true); END IF;
  IF v.estado <> 'enviada' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_pricing_opciones WHERE solicitud_id = p_id) THEN
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
END $$;

-- Cancelar (solicitante o Pricing), mientras no esté respondida.
CREATE OR REPLACE FUNCTION public.crm_cancelar_solicitud_pricing(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record;
BEGIN
  SELECT * INTO v FROM public.crm_solicitudes_pricing WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_PRICING_NO_ENCONTRADA' USING ERRCODE = 'P0001';
  END IF;
  IF v.created_by IS DISTINCT FROM auth.uid() AND NOT public._crm_es_pricing(v.organization_id) THEN
    RAISE EXCEPTION 'LC_PRICING_SIN_PERMISO' USING ERRCODE = '42501';
  END IF;
  IF v.estado = 'cancelada' THEN RETURN; END IF;
  IF v.estado = 'respondida' THEN RAISE EXCEPTION 'LC_PRICING_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  PERFORM set_config('lc.pricing_rpc', '1', true);
  UPDATE public.crm_solicitudes_pricing SET estado = 'cancelada' WHERE id = p_id;
  PERFORM set_config('lc.pricing_rpc', '', true);
END $$;

-- Usuarios de la empresa para el selector de solicitante.
CREATE OR REPLACE FUNCTION public.crm_usuarios_org() RETURNS TABLE(user_id uuid, nombre text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.user_id,
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email)::text,
         om.role::text
    FROM public.organization_members om
    JOIN auth.users u ON u.id = om.user_id
   WHERE om.organization_id = public.org_scope()
     AND om.role NOT IN ('cliente','agente_carga')
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.crm_enviar_solicitud_pricing(uuid), public.crm_responder_solicitud_pricing(uuid),
  public.crm_cancelar_solicitud_pricing(uuid), public.crm_usuarios_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_enviar_solicitud_pricing(uuid), public.crm_responder_solicitud_pricing(uuid),
  public.crm_cancelar_solicitud_pricing(uuid), public.crm_usuarios_org() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._crm_sol_pricing_before_ins(), public._crm_pricing_opcion_guard() FROM PUBLIC, anon, authenticated;

INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
VALUES ('00000000-0000-0000-0000-000000000001', 'pricing', 80)
ON CONFLICT (organization_id, tipo) DO NOTHING;
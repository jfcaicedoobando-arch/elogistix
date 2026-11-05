ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS autorizacion_solicitada_at timestamptz,
  ADD COLUMN IF NOT EXISTS autorizada_at timestamptz,
  ADD COLUMN IF NOT EXISTS autorizada_por uuid,
  ADD COLUMN IF NOT EXISTS margen_autorizado_pct numeric,
  ADD COLUMN IF NOT EXISTS autorizacion_motivo text;

-- Margen estimado en USD (venta neta de conceptos vs costos internos vivos). NULL si no se puede calcular.
CREATE OR REPLACE FUNCTION public._cotizacion_margen_pct(p_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_venta numeric := 0; v_costo numeric := 0; v_tc numeric; r record;
BEGIN
  SELECT conceptos_venta, tipo_cambio_usd INTO c FROM cotizaciones WHERE id = p_id;
  v_tc := NULLIF(c.tipo_cambio_usd, 0);
  FOR r IN SELECT coalesce(e->>'moneda', 'USD') AS moneda,
                  coalesce((e->>'cantidad')::numeric, 0) * coalesce((e->>'precio_unitario')::numeric, 0) AS monto
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.conceptos_venta) = 'array' THEN c.conceptos_venta ELSE '[]'::jsonb END) e
  LOOP
    IF r.moneda = 'MXN' THEN
      IF v_tc IS NULL THEN RETURN NULL; END IF;
      v_venta := v_venta + r.monto / v_tc;
    ELSE v_venta := v_venta + r.monto; END IF;
  END LOOP;
  FOR r IN SELECT moneda, coalesce(costo_total, 0) AS monto FROM cotizacion_costos WHERE cotizacion_id = p_id AND deleted_at IS NULL LOOP
    IF r.moneda = 'MXN' THEN
      IF v_tc IS NULL THEN RETURN NULL; END IF;
      v_costo := v_costo + r.monto / v_tc;
    ELSE v_costo := v_costo + r.monto; END IF;
  END LOOP;
  IF v_venta <= 0 THEN RETURN NULL; END IF;
  RETURN round((v_venta - v_costo) / v_venta * 100, 2);
END $$;
REVOKE ALL ON FUNCTION public._cotizacion_margen_pct(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cotizacion_es_autorizador(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'super_admin'::app_role) OR EXISTS (
    SELECT 1 FROM organization_members WHERE organization_id = p_org AND user_id = auth.uid()
      AND role IN ('admin','admin_org','gerente_comercial'))
$$;
REVOKE ALL ON FUNCTION public._cotizacion_es_autorizador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cotizacion_es_autorizador(uuid) TO authenticated;

-- Guard: la autorización sólo cambia por RPC; editar montos la invalida; enviar/aceptar exige autorización.
CREATE OR REPLACE FUNCTION public._cotizacion_autorizacion_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.autorizacion_solicitada_at := NULL; NEW.autorizada_at := NULL; NEW.autorizada_por := NULL;
    NEW.margen_autorizado_pct := NULL; NEW.autorizacion_motivo := NULL;
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('lc.cot_autorizacion', true), '') <> '1' AND (
     NEW.autorizacion_solicitada_at IS DISTINCT FROM OLD.autorizacion_solicitada_at
     OR NEW.autorizada_at IS DISTINCT FROM OLD.autorizada_at OR NEW.autorizada_por IS DISTINCT FROM OLD.autorizada_por
     OR NEW.margen_autorizado_pct IS DISTINCT FROM OLD.margen_autorizado_pct
     OR NEW.autorizacion_motivo IS DISTINCT FROM OLD.autorizacion_motivo) THEN
    RAISE EXCEPTION 'LC_COT_AUTORIZACION_SOLO_RPC' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.autorizada_at IS NOT NULL AND NEW.estado IN ('Borrador','Solicitada') AND (
     NEW.conceptos_venta IS DISTINCT FROM OLD.conceptos_venta OR NEW.moneda IS DISTINCT FROM OLD.moneda
     OR NEW.tipo_cambio_usd IS DISTINCT FROM OLD.tipo_cambio_usd OR NEW.subtotal IS DISTINCT FROM OLD.subtotal) THEN
    NEW.autorizada_at := NULL; NEW.autorizada_por := NULL; NEW.margen_autorizado_pct := NULL;
    NEW.autorizacion_motivo := NULL; NEW.autorizacion_solicitada_at := NULL;
  END IF;
  IF OLD.estado IN ('Borrador','Solicitada') AND NEW.estado IN ('Enviada','Aceptada') AND NEW.autorizada_at IS NULL THEN
    RAISE EXCEPTION 'LC_COT_SIN_AUTORIZACION: un administrador o el gerente comercial debe autorizar la cotización antes de enviarla o aceptarla'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cotizacion_autorizacion_guard
BEFORE INSERT OR UPDATE ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public._cotizacion_autorizacion_guard();

-- Cambiar costos internos también invalida la autorización vigente.
CREATE OR REPLACE FUNCTION public._cotizacion_costos_invalidar_autorizacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := coalesce(NEW.cotizacion_id, OLD.cotizacion_id);
BEGIN
  PERFORM set_config('lc.cot_autorizacion', '1', true);
  UPDATE cotizaciones SET autorizada_at = NULL, autorizada_por = NULL, margen_autorizado_pct = NULL,
         autorizacion_motivo = NULL, autorizacion_solicitada_at = NULL
   WHERE id = v_id AND autorizada_at IS NOT NULL AND estado IN ('Borrador','Solicitada');
  PERFORM set_config('lc.cot_autorizacion', '', true);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public._cotizacion_costos_invalidar_autorizacion() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_cotizacion_costos_invalidar_autorizacion
AFTER INSERT OR UPDATE OR DELETE ON public.cotizacion_costos
FOR EACH ROW EXECUTE FUNCTION public._cotizacion_costos_invalidar_autorizacion();

CREATE OR REPLACE FUNCTION public.solicitar_autorizacion_cotizacion(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_margen numeric;
BEGIN
  SELECT * INTO v FROM cotizaciones WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM org_scope() THEN RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA' USING ERRCODE = 'P0001'; END IF;
  PERFORM _assert_writer_cotizacion(v.organization_id);
  IF v.estado NOT IN ('Borrador','Solicitada') THEN RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF v.autorizada_at IS NOT NULL THEN RETURN jsonb_build_object('ya_autorizada', true); END IF;
  IF v.autorizacion_solicitada_at IS NOT NULL THEN RETURN jsonb_build_object('ya_solicitada', true); END IF;
  v_margen := _cotizacion_margen_pct(p_id);
  PERFORM set_config('lc.cot_autorizacion', '1', true);
  UPDATE cotizaciones SET autorizacion_solicitada_at = now() WHERE id = p_id;
  PERFORM set_config('lc.cot_autorizacion', '', true);
  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT v.organization_id, om.user_id, 'cotizacion_por_autorizar', 'Cotización por autorizar ' || coalesce(v.folio, ''),
         coalesce(v.cliente_nombre, v.prospecto_empresa, 'Sin cliente') || ' · margen estimado: '
           || coalesce(v_margen::text || ' %', 'no calculable'),
         '/cotizaciones/' || v.id, 'cotizacion', v.id
    FROM organization_members om
   WHERE om.organization_id = v.organization_id AND om.role IN ('admin','admin_org','gerente_comercial');
  RETURN jsonb_build_object('ya_solicitada', false, 'margen_pct', v_margen);
END $$;

CREATE OR REPLACE FUNCTION public.autorizar_cotizacion(p_id uuid, p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v record; v_margen numeric; v_min numeric;
BEGIN
  SELECT * INTO v FROM cotizaciones WHERE id = p_id AND deleted_at IS NULL FOR UPDATE;
  IF v.id IS NULL OR v.organization_id IS DISTINCT FROM org_scope() THEN RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA' USING ERRCODE = 'P0001'; END IF;
  IF NOT _cotizacion_es_autorizador(v.organization_id) THEN RAISE EXCEPTION 'LC_COT_SOLO_AUTORIZADOR' USING ERRCODE = '42501'; END IF;
  IF v.estado NOT IN ('Borrador','Solicitada') THEN RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO' USING ERRCODE = 'P0001'; END IF;
  IF v.autorizada_at IS NOT NULL THEN RETURN jsonb_build_object('ya_autorizada', true, 'margen_pct', v.margen_autorizado_pct); END IF;
  v_margen := _cotizacion_margen_pct(p_id);
  SELECT (valor #>> '{}')::numeric INTO v_min FROM configuracion
   WHERE organization_id = v.organization_id AND categoria = 'comercial' AND clave = 'margen_minimo_utilidad_pct';
  v_min := coalesce(v_min, 8);
  IF (v_margen IS NULL OR v_margen < v_min) AND length(trim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'LC_COT_MARGEN_BAJO_MINIMO: margen %, mínimo %', coalesce(v_margen::text, 'no calculable'), v_min
      USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('lc.cot_autorizacion', '1', true);
  UPDATE cotizaciones SET autorizada_at = now(), autorizada_por = auth.uid(), margen_autorizado_pct = v_margen,
         autorizacion_motivo = NULLIF(trim(coalesce(p_motivo, '')), ''),
         autorizacion_solicitada_at = coalesce(autorizacion_solicitada_at, now())
   WHERE id = p_id;
  PERFORM set_config('lc.cot_autorizacion', '', true);
  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v.organization_id, x.uid, 'cotizacion_autorizada', 'Cotización autorizada ' || coalesce(v.folio, ''),
         'Ya puedes enviarla al cliente. Margen: ' || coalesce(v_margen::text || ' %', 'no calculable'),
         '/cotizaciones/' || v.id, 'cotizacion', v.id
    FROM (SELECT DISTINCT unnest(ARRAY[v.created_by, v.vendedor_id]) AS uid) x
   WHERE x.uid IS NOT NULL AND x.uid IS DISTINCT FROM auth.uid();
  RETURN jsonb_build_object('ya_autorizada', false, 'margen_pct', v_margen, 'minimo_pct', v_min);
END $$;
REVOKE ALL ON FUNCTION public.solicitar_autorizacion_cotizacion(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.autorizar_cotizacion(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_autorizacion_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.autorizar_cotizacion(uuid, text) TO authenticated;

-- El handover ahora nace al autorizar (no al aceptar).
DROP TRIGGER IF EXISTS trg_cotizacion_crear_handover ON public.cotizaciones;
CREATE OR REPLACE FUNCTION public._cotizacion_crear_handover()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_coord uuid;
  v_fk text;
  v_msg text;
BEGIN
  IF NEW.autorizada_at IS NULL OR OLD.autorizada_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM cotizacion_handovers WHERE cotizacion_id = NEW.id) THEN RETURN NEW; END IF;
  -- Serializa el turno por organización para que dos autorizaciones simultáneas no caigan al mismo coordinador.
  PERFORM pg_advisory_xact_lock(hashtext('handover:' || NEW.organization_id::text));
  SELECT m.user_id INTO v_coord
  FROM organization_members m
  LEFT JOIN LATERAL (
    SELECT max(h.created_at) AS ultima FROM cotizacion_handovers h
    WHERE h.organization_id = m.organization_id AND h.coordinador_id = m.user_id
  ) u ON true
  WHERE m.organization_id = NEW.organization_id AND m.role = 'coordinador_logistico'
  ORDER BY u.ultima NULLS FIRST, m.created_at, m.user_id
  LIMIT 1;

  INSERT INTO cotizacion_handovers (organization_id, cotizacion_id, coordinador_id)
  VALUES (NEW.organization_id, NEW.id, v_coord);

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM crm_oportunidades o JOIN crm_leads l ON l.id = o.lead_id
    WHERE o.id = NEW.oportunidad_id AND l.fuente::text = 'Finkargo') THEN 'Sí' ELSE 'No' END INTO v_fk;

  v_msg := format('Cliente: %s | Cliente FK: %s | %s %s | %s → %s | %s | Contenedor: %s x%s | Peso: %s kg | Vol: %s m3 | Seguro: %s',
    COALESCE(NEW.cliente_nombre, NEW.prospecto_empresa, '—'), v_fk, COALESCE(NEW.modo::text, ''), COALESCE(NEW.incoterm::text, ''),
    COALESCE(NEW.origen, '—'), COALESCE(NEW.destino, '—'), COALESCE(NEW.descripcion_mercancia, '—'),
    COALESCE(NEW.tipo_contenedor, '—'), COALESCE(NEW.num_contenedores::text, '—'),
    COALESCE(NEW.peso_kg::text, '—'), COALESCE(NEW.volumen_m3::text, '—'),
    CASE WHEN NEW.seguro THEN 'Sí' ELSE 'No' END);

  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT DISTINCT NEW.organization_id, x.uid, 'handover',
    'Handover ' || COALESCE(NEW.folio, '') || CASE WHEN x.uid = v_coord THEN ' asignado a ti' ELSE '' END,
    v_msg, '/cotizaciones/' || NEW.id, 'cotizacion', NEW.id
  FROM (
    SELECT v_coord AS uid WHERE v_coord IS NOT NULL
    UNION SELECT user_id FROM organization_members WHERE organization_id = NEW.organization_id AND role = 'gerente_operaciones'
  ) x;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cotizacion_crear_handover
AFTER UPDATE OF autorizada_at ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public._cotizacion_crear_handover();
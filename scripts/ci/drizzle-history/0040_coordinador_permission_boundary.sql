-- Forward-only permission boundary. No historical data or assignment backfill.
CREATE OR REPLACE FUNCTION public._puede_asignar_coordinador(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND p_org IS NOT NULL
    AND p_org = public.org_scope()
    AND (public.has_role(auth.uid(), 'super_admin'::public.app_role) OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = p_org AND m.user_id = auth.uid()
        AND m.role::text IN ('gerente_operaciones','admin','admin_org')));
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.asignar_coordinador_cliente(p_cliente_id uuid, p_coordinador_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_org uuid; v_scope uuid := public.org_scope();
BEGIN
  IF auth.uid() IS NULL OR v_scope IS NULL OR NOT public._puede_asignar_coordinador(v_scope) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: sólo gerente de operaciones o administración de la empresa activa' USING ERRCODE = '42501';
  END IF;
  SELECT organization_id INTO v_org FROM public.clientes WHERE id = p_cliente_id AND organization_id = v_scope FOR UPDATE;
  IF v_org IS NULL THEN RAISE EXCEPTION 'LC_CLIENTE_NO_EXISTE: cliente no encontrado' USING ERRCODE = 'P0001'; END IF;
  IF NOT public._puede_asignar_coordinador(v_org) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: sólo gerente de operaciones o administración' USING ERRCODE = '42501';
  END IF;
  IF p_coordinador_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organization_members
      WHERE organization_id = v_org AND user_id = p_coordinador_id AND role = 'coordinador_logistico') THEN
    RAISE EXCEPTION 'LC_COORDINADOR_INVALIDO: el usuario no es coordinador logístico de la empresa' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.clientes SET coordinador_logistico_id = p_coordinador_id WHERE id = p_cliente_id AND organization_id = v_org;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.reasignar_coordinador_handover(p_cotizacion_id uuid, p_coordinador_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v_org uuid; v_scope uuid := public.org_scope(); v_folio text;
BEGIN
  IF auth.uid() IS NULL OR v_scope IS NULL OR NOT public._puede_asignar_coordinador(v_scope) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: sólo gerente de operaciones o administración de la empresa activa' USING ERRCODE = '42501';
  END IF;
  SELECT h.organization_id, c.folio INTO v_org, v_folio FROM public.cotizacion_handovers h
    JOIN public.cotizaciones c ON c.id = h.cotizacion_id AND c.organization_id = h.organization_id
    WHERE h.cotizacion_id = p_cotizacion_id AND h.organization_id = v_scope FOR UPDATE OF h, c;
  IF v_org IS NULL THEN RAISE EXCEPTION 'LC_HANDOVER_NO_EXISTE: la cotización no tiene handover' USING ERRCODE = 'P0001'; END IF;
  IF NOT public._puede_asignar_coordinador(v_org) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: sólo gerente de operaciones o administración' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members
      WHERE organization_id = v_org AND user_id = p_coordinador_id AND role IN ('coordinador_logistico','gerente_operaciones')) THEN
    RAISE EXCEPTION 'LC_COORDINADOR_INVALIDO: el usuario no pertenece a Operaciones' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.cotizacion_handovers SET coordinador_id = p_coordinador_id WHERE cotizacion_id = p_cotizacion_id AND organization_id = v_org;
  INSERT INTO notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  VALUES (v_org, p_coordinador_id, 'handover', 'Handover ' || COALESCE(v_folio, '') || ' asignado a ti',
    'Operaciones te reasignó esta operación.', '/cotizaciones/' || p_cotizacion_id, 'cotizacion', p_cotizacion_id);
END $$;
--> statement-breakpoint

-- Invoker is intentional: an authenticated direct write retains its identity;
-- the existing owner-executed handover and validated RPCs retain theirs.
CREATE OR REPLACE FUNCTION public._cliente_coordinador_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_RELID <> 'public.clientes'::regclass OR TG_LEVEL <> 'ROW' OR TG_WHEN <> 'BEFORE'
      OR TG_OP NOT IN ('INSERT', 'UPDATE') THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: contexto de coordinador inválido' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.coordinador_logistico_id IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.coordinador_logistico_id IS NOT DISTINCT FROM OLD.coordinador_logistico_id
      AND (NEW.coordinador_logistico_id IS NULL OR NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id) THEN
    RETURN NEW;
  END IF;
  -- Only the actual table owner is trusted here, never a caller-controlled GUC
  -- or trigger depth. This preserves automatic first-handover assignment.
  IF current_user = (SELECT pg_catalog.pg_get_userbyid(c.relowner)
      FROM pg_catalog.pg_class c WHERE c.oid = TG_RELID) THEN RETURN NEW; END IF;
  IF NOT COALESCE(public._puede_asignar_coordinador(NEW.organization_id), false) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: sólo gerente de operaciones o administración' USING ERRCODE = '42501';
  END IF;
  IF NEW.coordinador_logistico_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organization_members m WHERE m.organization_id = NEW.organization_id
        AND m.user_id = NEW.coordinador_logistico_id AND m.role = 'coordinador_logistico') THEN
    RAISE EXCEPTION 'LC_COORDINADOR_INVALIDO: el usuario no es coordinador logístico de la empresa' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public._cliente_coordinador_guard() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
CREATE TRIGGER cliente_coordinador_guard BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public._cliente_coordinador_guard();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public._cotizacion_crear_handover() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog, public, pg_temp AS $$
DECLARE
  v_coord uuid;
  v_fk text;
  v_msg text;
  v_tipo text;
  v_fijo uuid;
BEGIN
  IF TG_RELID <> 'public.cotizaciones'::regclass OR TG_LEVEL <> 'ROW'
      OR TG_WHEN <> 'AFTER' OR TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO: contexto de handover inválido' USING ERRCODE = '42501';
  END IF;
  IF NEW.autorizada_at IS NULL OR OLD.autorizada_at IS NOT NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM cotizacion_handovers WHERE cotizacion_id = NEW.id) THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('handover:' || NEW.organization_id::text));
  SELECT c.tipo_cliente, c.coordinador_logistico_id INTO v_tipo, v_fijo
    FROM clientes c WHERE c.id = NEW.cliente_id AND c.organization_id = NEW.organization_id;
  IF v_tipo = 'especial' THEN
    -- Clientes especiales: los atiende quien creó la cotización.
    v_coord := NEW.created_by;
  ELSIF v_fijo IS NOT NULL AND EXISTS (SELECT 1 FROM organization_members m
      WHERE m.organization_id = NEW.organization_id AND m.user_id = v_fijo AND m.role = 'coordinador_logistico') THEN
    v_coord := v_fijo;
  ELSE
    SELECT m.user_id INTO v_coord
    FROM organization_members m
    LEFT JOIN LATERAL (
      SELECT max(h.created_at) AS ultima FROM cotizacion_handovers h
      WHERE h.organization_id = m.organization_id AND h.coordinador_id = m.user_id
    ) u ON true
    WHERE m.organization_id = NEW.organization_id AND m.role = 'coordinador_logistico'
    ORDER BY u.ultima NULLS FIRST, m.created_at, m.user_id
    LIMIT 1;
    IF v_coord IS NOT NULL AND NEW.cliente_id IS NOT NULL THEN
      UPDATE clientes SET coordinador_logistico_id = v_coord
       WHERE id = NEW.cliente_id AND organization_id = NEW.organization_id;
    END IF;
  END IF;
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

--> statement-breakpoint
REVOKE ALL ON FUNCTION public._cotizacion_crear_handover() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS estado_alta text NOT NULL DEFAULT 'aprobado',
  ADD COLUMN IF NOT EXISTS aprobado_por uuid,
  ADD COLUMN IF NOT EXISTS aprobado_at timestamptz;
ALTER TABLE public.proveedores ADD CONSTRAINT proveedores_estado_alta_chk CHECK (estado_alta IN ('provisional','aprobado'));

CREATE OR REPLACE FUNCTION public.crear_agente_provisional(p_nombre text, p_pais text DEFAULT 'CN', p_contacto text DEFAULT NULL, p_email text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid := public.current_user_org_id(); v_nombre text := btrim(coalesce(p_nombre,'')); v_prov uuid; v_ag uuid;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Sin organización activa' USING ERRCODE='42501'; END IF;
  IF NOT (public._crm_es_pricing(v_org) OR public.has_any_role_in_org(auth.uid(), ARRAY['admin']::app_role[], v_org)) THEN
    RAISE EXCEPTION 'No tienes permiso para dar de alta agentes' USING ERRCODE='42501'; END IF;
  IF length(v_nombre) < 2 THEN RAISE EXCEPTION 'El nombre del agente es obligatorio' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_org::text || lower(v_nombre)));
  SELECT a.id INTO v_ag FROM costeo_agentes a WHERE a.organization_id = v_org AND lower(btrim(a.nombre)) = lower(v_nombre) LIMIT 1;
  IF v_ag IS NOT NULL THEN RETURN v_ag; END IF;
  SELECT id INTO v_prov FROM proveedores WHERE organization_id = v_org AND deleted_at IS NULL AND tipo = 'Agente de Carga' AND lower(btrim(nombre)) = lower(v_nombre) LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO proveedores (nombre, tipo, pais, contacto, email, organization_id, origen_proveedor, estado_alta)
    VALUES (v_nombre, 'Agente de Carga', coalesce(nullif(btrim(p_pais),''),'CN'), coalesce(p_contacto,''), coalesce(p_email,''), v_org, 'Extranjero', 'provisional')
    RETURNING id INTO v_prov;
  END IF;
  INSERT INTO costeo_agentes (organization_id, proveedor_id, nombre, pais, contacto_tarifario, email, notas)
  VALUES (v_org, v_prov, v_nombre, coalesce(nullif(btrim(p_pais),''),'CN'), p_contacto, p_email, 'Alta provisional desde tarifa')
  RETURNING id INTO v_ag;
  RETURN v_ag;
END $$;
REVOKE ALL ON FUNCTION public.crear_agente_provisional(text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crear_agente_provisional(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.aprobar_proveedor_provisional(p_proveedor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r proveedores%ROWTYPE; v_faltan text[] := '{}';
BEGIN
  SELECT * INTO r FROM proveedores WHERE id = p_proveedor_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR r.organization_id IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'Proveedor no encontrado' USING ERRCODE='P0002'; END IF;
  IF NOT public.has_any_role_in_org(auth.uid(), ARRAY['admin','contador']::app_role[], r.organization_id) THEN
    RAISE EXCEPTION 'Sólo Contabilidad puede aprobar proveedores' USING ERRCODE='42501'; END IF;
  IF r.estado_alta = 'aprobado' THEN RETURN; END IF;
  IF btrim(r.rfc) = '' THEN v_faltan := v_faltan || 'RFC / Tax ID'; END IF;
  IF btrim(r.contacto) = '' THEN v_faltan := v_faltan || 'Contacto'; END IF;
  IF btrim(r.email) = '' THEN v_faltan := v_faltan || 'Correo'; END IF;
  IF coalesce(btrim(r.clabe),'') = '' AND coalesce(btrim(r.swift_bic),'') = '' AND coalesce(btrim(r.iban),'') = '' THEN
    v_faltan := v_faltan || 'Datos bancarios (CLABE, SWIFT o IBAN)'; END IF;
  IF array_length(v_faltan,1) > 0 THEN
    RAISE EXCEPTION 'Faltan datos para aprobar: %', array_to_string(v_faltan, ', ') USING ERRCODE='23514'; END IF;
  UPDATE proveedores SET estado_alta='aprobado', aprobado_por=auth.uid(), aprobado_at=now() WHERE id = r.id;
END $$;
REVOKE ALL ON FUNCTION public.aprobar_proveedor_provisional(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_proveedor_provisional(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._proveedor_factura_no_provisional() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.proveedor_id IS NOT NULL AND EXISTS (SELECT 1 FROM proveedores WHERE id = NEW.proveedor_id AND estado_alta = 'provisional') THEN
    RAISE EXCEPTION 'Este proveedor está pendiente de aprobación por Contabilidad' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proveedor_factura_no_provisional BEFORE INSERT OR UPDATE OF proveedor_id ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public._proveedor_factura_no_provisional();

CREATE OR REPLACE FUNCTION public._pago_proveedor_no_provisional() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM proveedor_facturas f JOIN proveedores p ON p.id = f.proveedor_id
             WHERE f.id = NEW.proveedor_factura_id AND p.estado_alta = 'provisional') THEN
    RAISE EXCEPTION 'Este proveedor está pendiente de aprobación por Contabilidad' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_pago_proveedor_no_provisional BEFORE INSERT ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public._pago_proveedor_no_provisional();
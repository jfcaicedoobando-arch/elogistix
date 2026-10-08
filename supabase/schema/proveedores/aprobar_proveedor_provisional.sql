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
  IF btrim(r.rfc) = '' THEN v_faltan := array_append(v_faltan, 'RFC / Tax ID'::text); END IF;
  IF btrim(r.contacto) = '' THEN v_faltan := array_append(v_faltan, 'Contacto'::text); END IF;
  IF btrim(r.email) = '' THEN v_faltan := array_append(v_faltan, 'Correo'::text); END IF;
  IF coalesce(btrim(r.clabe),'') = '' AND coalesce(btrim(r.swift_bic),'') = '' AND coalesce(btrim(r.iban),'') = '' THEN
    v_faltan := array_append(v_faltan, 'Datos bancarios (CLABE, SWIFT o IBAN)'::text); END IF;
  IF array_length(v_faltan,1) > 0 THEN
    RAISE EXCEPTION 'Faltan datos para aprobar: %', array_to_string(v_faltan, ', ') USING ERRCODE='23514'; END IF;
  UPDATE proveedores SET estado_alta='aprobado', aprobado_por=auth.uid(), aprobado_at=now() WHERE id = r.id;
END $$;
REVOKE ALL ON FUNCTION public.aprobar_proveedor_provisional(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_proveedor_provisional(uuid) TO authenticated;

-- Q-04 (a) · SoD en proveedor_facturas: tesorero = solo lectura
DROP POLICY IF EXISTS "Tenant CRUD proveedor_facturas" ON public.proveedor_facturas;

-- Lectura amplia (incluye tesorero: necesita ver para pagar)
CREATE POLICY "Tenant read proveedor_facturas"
ON public.proveedor_facturas
FOR SELECT TO authenticated
USING (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)
    OR public.has_role((SELECT auth.uid()), 'tesorero'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = (SELECT auth.uid())
         AND om.organization_id = proveedor_facturas.organization_id
         AND om.role = ANY (ARRAY['admin_org'::app_role,'admin'::app_role,'contador'::app_role,'auxiliar_contable'::app_role,'tesorero'::app_role])
    )
  )
);

-- Escritura restringida (sin tesorero)
CREATE POLICY "Captura proveedor_facturas insert"
ON public.proveedor_facturas
FOR INSERT TO authenticated
WITH CHECK (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = (SELECT auth.uid())
         AND om.organization_id = proveedor_facturas.organization_id
         AND om.role = ANY (ARRAY['admin_org'::app_role,'admin'::app_role,'contador'::app_role,'auxiliar_contable'::app_role])
    )
  )
);

CREATE POLICY "Captura proveedor_facturas update"
ON public.proveedor_facturas
FOR UPDATE TO authenticated
USING (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = (SELECT auth.uid())
         AND om.organization_id = proveedor_facturas.organization_id
         AND om.role = ANY (ARRAY['admin_org'::app_role,'admin'::app_role,'contador'::app_role,'auxiliar_contable'::app_role])
    )
  )
)
WITH CHECK (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'auxiliar_contable'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = (SELECT auth.uid())
         AND om.organization_id = proveedor_facturas.organization_id
         AND om.role = ANY (ARRAY['admin_org'::app_role,'admin'::app_role,'contador'::app_role,'auxiliar_contable'::app_role])
    )
  )
);

CREATE POLICY "Captura proveedor_facturas delete"
ON public.proveedor_facturas
FOR DELETE TO authenticated
USING (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'contador'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.user_id = (SELECT auth.uid())
         AND om.organization_id = proveedor_facturas.organization_id
         AND om.role = ANY (ARRAY['admin_org'::app_role,'admin'::app_role,'contador'::app_role])
    )
  )
);

-- Q-04 (a2) · aprobación: sin tesorero + aprobador distinto del capturista
CREATE OR REPLACE FUNCTION public.aprobar_factura_proveedor(p_id uuid, p_aprobar boolean, p_motivo text DEFAULT NULL::text)
 RETURNS proveedor_facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_es_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede aprobar ni rechazar facturas de proveedor.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin'])
  ) INTO v_es_admin;

  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_id AND deleted_at IS NULL;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = v_row.organization_id
          AND om.user_id = v_uid
     )
  THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = '42501';
  END IF;

  IF v_row.estado_aprobacion <> 'pendiente' THEN
    RAISE EXCEPTION 'La factura ya fue %', v_row.estado_aprobacion;
  END IF;

  -- SoD: quien capturó no aprueba su propia factura (salvo administradores)
  IF p_aprobar
     AND v_row.created_by IS NOT NULL
     AND v_row.created_by = v_uid
     AND NOT v_es_admin
  THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: No puedes aprobar una factura que tú mismo capturaste. Pide la aprobación a otra persona.';
  END IF;

  IF p_aprobar THEN
    PERFORM public._cxp_validar_aprobacion(p_id);
  END IF;

  IF p_aprobar THEN
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'aprobada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = NULL
    WHERE id = p_id RETURNING * INTO v_row;
  ELSE
    IF COALESCE(trim(p_motivo),'') = '' THEN
      RAISE EXCEPTION 'Motivo de rechazo requerido';
    END IF;
    UPDATE public.proveedor_facturas
    SET estado_aprobacion = 'rechazada', aprobada_por = v_uid, aprobada_at = now(), motivo_rechazo = p_motivo
    WHERE id = p_id RETURNING * INTO v_row;
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (
      v_row.organization_id,
      v_uid,
      COALESCE(v_email, ''),
      CASE WHEN p_aprobar THEN 'aprobar_factura_proveedor' ELSE 'rechazar_factura_proveedor' END,
      'cxp',
      v_row.id,
      'Factura ' || COALESCE(v_row.folio_proveedor,'') || ' de ' || COALESCE(v_row.proveedor_nombre,''),
      jsonb_build_object('motivo', p_motivo, 'total', v_row.total, 'aprobada', p_aprobar)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora_actividad insert failed in aprobar_factura_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprobar_factura_proveedor(uuid, boolean, text) TO authenticated;
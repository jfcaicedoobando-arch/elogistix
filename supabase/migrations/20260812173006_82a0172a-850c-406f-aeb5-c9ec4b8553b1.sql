-- FIX BL-02: registrar_bitacora aceptaba p_organization_id y p_usuario_id arbitrarios.
CREATE OR REPLACE FUNCTION public.registrar_bitacora(
  p_modulo text,
  p_accion text,
  p_entidad_id uuid DEFAULT NULL,
  p_entidad_nombre text DEFAULT '',
  p_detalles jsonb DEFAULT '{}'::jsonb,
  p_organization_id uuid DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid := COALESCE(p_usuario_id, auth.uid());
  v_org uuid := p_organization_id;
  v_email text;
BEGIN
  -- FIX BL-02: con JWT de usuario solo se puede escribir con identidad propia y
  -- en una organización de la que el usuario sea miembro. service_role y
  -- llamadas internas sin JWT de usuario quedan fuera del guard.
  IF auth.role() = 'authenticated' AND auth.uid() IS NOT NULL THEN
    v_uid := auth.uid();
    IF v_org IS NOT NULL
       AND v_org IS DISTINCT FROM public.current_user_org_id()
       AND NOT EXISTS (
         SELECT 1 FROM public.organization_members om
          WHERE om.user_id = auth.uid() AND om.organization_id = v_org
       )
       AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'LC_ORG_AJENA: no puedes registrar bitácora de otra organización'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_org IS NULL AND v_uid IS NOT NULL THEN
    SELECT organization_id INTO v_org
      FROM public.organization_members WHERE user_id = v_uid LIMIT 1;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;

  INSERT INTO public.bitacora_actividad(
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_org, v_uid, COALESCE(v_email, ''), p_accion, p_modulo,
    p_entidad_id, COALESCE(p_entidad_nombre, ''), COALESCE(p_detalles, '{}'::jsonb)
  );
EXCEPTION
  WHEN insufficient_privilege THEN RAISE;
  WHEN OTHERS THEN
    RAISE WARNING 'registrar_bitacora falló (%): %', p_accion, SQLERRM;
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) TO authenticated, service_role;

-- FIX N1: eliminar sobrecarga legacy text de log_client_error_v1 (idempotente).
DROP FUNCTION IF EXISTS public.log_client_error_v1(text, text, text, text, text, text, text);
REVOKE ALL ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) TO anon, authenticated, service_role;
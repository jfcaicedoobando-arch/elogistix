-- Espejo canónico de public.registrar_bitacora
-- Fuente vigente: 20261004055700_cxp_historial_eventos_reales.sql (AUD-57).
-- Endurecida por 20260910000500_bitacora_no_falsificable.sql (DEFECTO 8):
-- La escritura genérica de clientes `authenticated` pasa por este recorder.
-- RLS no tiene policies permisivas de INSERT/UPDATE, aunque conserva grants
-- de tabla; los eventos reservados los escribe su RPC de negocio.
-- Deriva usuario_id/email SIEMPRE del servidor (auth.uid()/auth.users) para
-- llamadas `authenticated`; p_usuario_id/p_organization_id sólo aplican a
-- llamadas sin JWT de usuario (contextos internos/servicio).
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.

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
  -- AUD-57: estas decisiones sólo las escribe su RPC de negocio, nunca el recorder.
  IF lower(btrim(COALESCE(p_accion, ''))) IN ('aprobar_factura_proveedor', 'rechazar_factura_proveedor') THEN
    RAISE EXCEPTION 'LC_BITACORA_ACCION_RESERVADA: la decisión se registra desde su RPC de negocio'
      USING ERRCODE = '42501';
  END IF;

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
GRANT EXECUTE ON FUNCTION public.registrar_bitacora(text, text, uuid, text, jsonb, uuid, uuid) TO authenticated;

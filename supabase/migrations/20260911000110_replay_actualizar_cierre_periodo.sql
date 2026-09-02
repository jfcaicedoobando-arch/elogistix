-- =========================================================
-- DEFECTO 4 (P1): CierrePeriodoCard escribía directo en `configuracion`,
-- permitiendo vaciar/retroceder el cierre de periodo sin motivo ni bitácora.
-- RPC SECURITY DEFINER: exige rol financiero exacto, permite avance
-- monotónico libre, exige motivo para retroceso/reapertura/vaciado y deja
-- bitácora siempre.
-- =========================================================

CREATE OR REPLACE FUNCTION public.actualizar_cierre_periodo(
  p_org uuid,
  p_fecha date,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_anterior  date;
  v_retroceso boolean;
  v_motivo    text := NULLIF(btrim(COALESCE(p_motivo, '')), '');
BEGIN
  IF p_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_REQUERIDA: se requiere la organización' USING ERRCODE = 'P0001';
  END IF;

  IF public.has_any_role_in_org(
       v_uid,
       ARRAY['admin','admin_org','contador','tesorero','super_admin']::public.app_role[],
       p_org
     ) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_ROL_INSUFICIENTE: necesitas un rol financiero o de administración para cambiar el cierre de periodo'
      USING ERRCODE = '42501';
  END IF;

  v_anterior := public.cierre_periodo_fecha(p_org);

  -- Retroceso: vaciar el cierre, o mover la fecha hacia atrás (reapertura).
  v_retroceso := v_anterior IS NOT NULL
                 AND (p_fecha IS NULL OR p_fecha < v_anterior);

  IF v_retroceso AND (v_motivo IS NULL OR length(v_motivo) < 10) THEN
    RAISE EXCEPTION 'LC_CIERRE_MOTIVO_REQUERIDO: para reabrir o retroceder el cierre de periodo debes capturar un motivo (mínimo 10 caracteres)'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.configuracion (organization_id, categoria, clave, valor)
  VALUES (p_org, 'contabilidad', 'cierre_periodo_fecha',
          CASE WHEN p_fecha IS NULL THEN 'null'::jsonb ELSE to_jsonb(p_fecha::text) END)
  ON CONFLICT (organization_id, categoria, clave)
  DO UPDATE SET valor = EXCLUDED.valor;

  PERFORM public.registrar_bitacora(
    'configuracion',
    'actualizar_cierre_periodo',
    NULL,
    'contabilidad.cierre_periodo_fecha',
    jsonb_build_object(
      'fecha_anterior', v_anterior,
      'fecha_nueva', p_fecha,
      'retroceso', v_retroceso,
      'motivo', v_motivo
    ),
    p_org,
    v_uid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_cierre_periodo(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_cierre_periodo(uuid, date, text) TO authenticated, service_role;
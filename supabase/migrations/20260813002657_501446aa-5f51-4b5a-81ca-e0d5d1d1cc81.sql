CREATE OR REPLACE FUNCTION public.actualizar_tc_embarque_dof(
  _embarque_id uuid,
  _fecha date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_estado text;
  v_usd_ant numeric; v_eur_ant numeric;
  v_tc RECORD;
BEGIN
  SELECT organization_id, estado::text, tipo_cambio_usd, tipo_cambio_eur
    INTO v_org, v_estado, v_usd_ant, v_eur_ant
  FROM public.embarques WHERE id = _embarque_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_writer(v_org);

  IF v_estado IN ('Cerrado','Cancelado') THEN
    RAISE EXCEPTION 'El embarque está %: el tipo de cambio ya no puede modificarse.', lower(v_estado)
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tc FROM public.tc_dof_vigente(_fecha);

  IF v_tc.usd_mxn IS NULL OR v_tc.usd_mxn <= 0 THEN
    RAISE EXCEPTION 'No hay tipo de cambio DOF publicado para el % o antes.', _fecha
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.embarques
     SET tipo_cambio_usd = v_tc.usd_mxn,
         tipo_cambio_eur = COALESCE(NULLIF(v_tc.eur_mxn, 0), tipo_cambio_eur),
         updated_at = now()
   WHERE id = _embarque_id;

  RETURN jsonb_build_object(
    'embarque_id', _embarque_id,
    'fecha_dof', v_tc.fecha,
    'usd_anterior', v_usd_ant,
    'usd_nuevo', v_tc.usd_mxn,
    'eur_anterior', v_eur_ant,
    'eur_nuevo', COALESCE(NULLIF(v_tc.eur_mxn, 0), v_eur_ant)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_tc_embarque_dof(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_tc_embarque_dof(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_tc_embarque_dof(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.actualizar_tc_embarque_dof(uuid, date) TO service_role;

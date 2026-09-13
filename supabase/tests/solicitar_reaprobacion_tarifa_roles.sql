-- Guard v13.823.347 — `solicitar_reaprobacion_tarifa` es SECURITY DEFINER y
-- cambia `estado_revalidacion` + bitácora + notificaciones. Debe exigir la
-- MISMA puerta de rol que `crear_embarque_borrador_core` (administración u
-- operación): sin ella cualquier viewer o contador de la organización podía
-- invocarla directo por la API aunque la UI oculte el botón.
--
-- También vigila que anon no conserve el privilegio EXECUTE.
--
-- Sólo lectura: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
  v_rol text;
  v_roles text[] := ARRAY[
    'admin_org','admin','gerente_operaciones','coordinador_logistico','operador'
  ];
BEGIN
  v_def := pg_get_functiondef(
    'public.solicitar_reaprobacion_tarifa(uuid, jsonb)'::regprocedure);

  IF v_def !~ 'LC_NO_AUTORIZADO' THEN
    RAISE EXCEPTION 'solicitar_reaprobacion_tarifa dejó de emitir LC_NO_AUTORIZADO';
  END IF;
  IF v_def !~ 'super_admin' THEN
    RAISE EXCEPTION 'solicitar_reaprobacion_tarifa perdió el bypass de super_admin';
  END IF;

  FOREACH v_rol IN ARRAY v_roles LOOP
    IF v_def !~ ('has_role\(auth\.uid\(\), ''' || v_rol || '''::app_role\)') THEN
      RAISE EXCEPTION
        'solicitar_reaprobacion_tarifa dejó de autorizar al rol de operación %', v_rol;
    END IF;
  END LOOP;

  IF v_def !~ 'current_user_org_id\(\)' THEN
    RAISE EXCEPTION 'solicitar_reaprobacion_tarifa dejó de validar la organización';
  END IF;

  IF has_function_privilege('anon',
       'public.solicitar_reaprobacion_tarifa(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon recuperó EXECUTE sobre solicitar_reaprobacion_tarifa';
  END IF;

  IF has_function_privilege('anon',
       'public.recotizar_cotizacion(uuid, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon recuperó EXECUTE sobre recotizar_cotizacion';
  END IF;

  RAISE NOTICE 'OK solicitar_reaprobacion_tarifa_roles';
END $$;

-- Guard: los destinatarios de la notificación interna de
-- `crear_embarque_borrador_core` deben cubrir EXACTAMENTE a los responsables
-- operativos autorizados a crear el borrador: admin, admin_org, operador,
-- gerente_operaciones y coordinador_logistico. El riesgo vigilado es que un
-- gerente de operaciones o coordinador logístico cree el borrador y el resto
-- del equipo operativo no se entere porque el INSERT filtraba sólo
-- ('admin','operador').
--
-- Sólo lectura sobre pg_get_functiondef: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);

  -- La notificación interna sigue existiendo.
  IF v_def !~ 'notificaciones_internas' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core perdió la notificación interna';
  END IF;

  -- Lista completa de destinatarios operativos.
  FOREACH v_rol IN ARRAY ARRAY[
    'admin','admin_org','operador','gerente_operaciones','coordinador_logistico'
  ] LOOP
    IF v_def !~ ('om\.role IN[^;]*''' || v_rol || '''::app_role') THEN
      RAISE EXCEPTION
        'la notificación de borrador dejó de incluir al rol % como destinatario', v_rol;
    END IF;
  END LOOP;

  -- Quien ejecuta la acción no se auto-notifica.
  IF v_def !~ 'om\.user_id <> auth\.uid\(\)' THEN
    RAISE EXCEPTION 'la notificación de borrador perdió la exclusión del autor';
  END IF;

  RAISE NOTICE 'OK crear_embarque_borrador_notificaciones_roles';
END $$;

-- Guard: la autorización de `crear_embarque_borrador_core` debe coincidir
-- EXACTAMENTE con la capability de UI CREAR_EMBARQUE_DESDE_COTIZACION:
-- super_admin, admin_org, admin, gerente_operaciones, coordinador_logistico y
-- operador. El riesgo vigilado es que la jerarquía de `has_role('operador')`
-- se amplíe (p. ej. a ejecutivo_pricing o gerente_visor) y otorgue la acción a
-- roles comerciales, de pricing, financieros o de sólo lectura.
--
-- Sólo lectura: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_esperados app_role[] := ARRAY[
    'super_admin','admin_org','admin','gerente_operaciones','coordinador_logistico','operador'
  ]::app_role[];
  v_jerarquia app_role[];
  v_def text;
  v_rol app_role;
BEGIN
  -- 1) La jerarquía de 'operador' es exactamente la lista autorizada.
  SELECT public.roles_jerarquia('operador'::app_role) INTO v_jerarquia;

  FOREACH v_rol IN ARRAY v_esperados LOOP
    IF NOT (v_rol = ANY (v_jerarquia)) THEN
      RAISE EXCEPTION 'roles_jerarquia(operador) perdió el rol autorizado %', v_rol;
    END IF;
  END LOOP;

  FOREACH v_rol IN ARRAY v_jerarquia LOOP
    IF NOT (v_rol = ANY (v_esperados)) THEN
      RAISE EXCEPTION
        'roles_jerarquia(operador) amplió la autorización al rol no permitido %', v_rol;
    END IF;
  END LOOP;

  -- 2) La RPC conserva el tenant check, los estados válidos, el candado de
  --    prospecto y la puerta de rol de operación.
  v_def := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);

  IF v_def !~ 'has_role\(auth\.uid\(\), ''operador''::app_role\)' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core dejó de exigir el rol de operación';
  END IF;
  IF v_def !~ 'LC_NO_AUTORIZADO' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core dejó de emitir LC_NO_AUTORIZADO';
  END IF;
  IF v_def !~ 'current_user_org_id\(\)' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core dejó de validar la organización';
  END IF;
  IF v_def !~ 'LC_COT_ESTADO_INVALIDO' OR v_def !~ 'En operación' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core dejó de exigir Aceptada/En operación';
  END IF;
  IF v_def !~ 'LC_COT_SIN_CLIENTE' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core dejó de bloquear prospectos';
  END IF;
  -- Idempotencia: si ya hay embarque vinculado, devuelve el existente.
  IF v_def !~ 'RETURN v_orphan_id;' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core perdió la salida idempotente';
  END IF;

  RAISE NOTICE 'OK crear_embarque_borrador_roles';
END $$;

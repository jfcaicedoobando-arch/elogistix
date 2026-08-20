-- BUG-09 (Ola G1) · Un embarque 'Cerrado' NO puede pasar directo a 'Cancelado'.
-- La regla vive en public.transicion_embarque_valida y la aplica
-- public.assert_transicion_embarque (usada por avanzar_estado_embarque).
-- Este test fija la matriz de transiciones para que la regla no regrese.
DO $$
DECLARE
  v_bloqueado boolean;
  v_permitido boolean;
  v_reapertura boolean;
  v_desde_cancelado boolean;
  v_overloads int;
  v_assert_falla boolean := false;
BEGIN
  -- 0) Una sola versión de la función (evita que un overload viejo gane).
  SELECT count(*) INTO v_overloads
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'transicion_embarque_valida';
  IF v_overloads <> 1 THEN
    RAISE EXCEPTION 'BUG-09: se esperaba 1 version de transicion_embarque_valida, hay %', v_overloads;
  END IF;

  -- 1) Cerrado -> Cancelado debe estar bloqueado.
  SELECT public.transicion_embarque_valida('Cerrado'::public.estado_embarque,
                                           'Cancelado'::public.estado_embarque)
    INTO v_bloqueado;
  IF v_bloqueado THEN
    RAISE EXCEPTION 'BUG-09 REGRESION: Cerrado -> Cancelado quedo permitido';
  END IF;

  -- 2) Un embarque vivo sí se puede cancelar.
  SELECT public.transicion_embarque_valida('Entregado'::public.estado_embarque,
                                           'Cancelado'::public.estado_embarque)
    INTO v_permitido;
  IF NOT v_permitido THEN
    RAISE EXCEPTION 'BUG-09: Entregado -> Cancelado deberia seguir permitido';
  END IF;

  -- 3) La salida documentada es reabrir primero.
  SELECT public.transicion_embarque_valida('Cerrado'::public.estado_embarque,
                                           'Por liquidar'::public.estado_embarque)
    INTO v_reapertura;
  IF NOT v_reapertura THEN
    RAISE EXCEPTION 'BUG-09: Cerrado -> Por liquidar (reapertura) deberia permitirse';
  END IF;

  -- 4) Cancelado es terminal.
  SELECT public.transicion_embarque_valida('Cancelado'::public.estado_embarque,
                                           'Confirmado'::public.estado_embarque)
    INTO v_desde_cancelado;
  IF v_desde_cancelado THEN
    RAISE EXCEPTION 'BUG-09: Cancelado deberia ser terminal';
  END IF;

  -- 5) El assert que consume avanzar_estado_embarque debe lanzar excepcion.
  BEGIN
    PERFORM public.assert_transicion_embarque('Cerrado'::public.estado_embarque,
                                              'Cancelado'::public.estado_embarque,
                                              'ELTEST00001');
  EXCEPTION WHEN OTHERS THEN
    v_assert_falla := true;
  END;
  IF NOT v_assert_falla THEN
    RAISE EXCEPTION 'BUG-09 REGRESION: assert_transicion_embarque no bloquea Cerrado -> Cancelado';
  END IF;

  RAISE NOTICE 'OK BUG-09: embarque Cerrado no cancelable (5 casos)';
END $$;

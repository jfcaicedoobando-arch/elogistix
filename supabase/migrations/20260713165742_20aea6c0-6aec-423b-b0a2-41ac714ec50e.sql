-- 1) Sincroniza la secuencia con el máximo consecutivo real observado en embarques.
--    Evita colisiones tras reasignaciones manuales (ELIMP00317/318).
DO $$
DECLARE
  v_max_real bigint;
  v_seq_now  bigint;
  v_target   bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(expediente, '\D', '', 'g'), '')::bigint), 0)
    INTO v_max_real
    FROM public.embarques;

  SELECT last_value INTO v_seq_now FROM public.embarque_consecutivo_seq;

  v_target := GREATEST(v_max_real, v_seq_now);
  PERFORM setval('public.embarque_consecutivo_seq', v_target, true);
END $$;

-- 2) resolver_expediente_por_bl: multi-tenant + respeta soft-delete.
CREATE OR REPLACE FUNCTION public.resolver_expediente_por_bl(_bl_master text, _tipo_op text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_exp text;
BEGIN
  -- Determina la organización efectiva del caller (impersonación incluida).
  v_org := public.current_user_org_id();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No hay organización activa para resolver el expediente por BL Master';
  END IF;

  SELECT expediente
    INTO v_exp
    FROM public.embarques
   WHERE bl_master = _bl_master
     AND organization_id = v_org
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_exp IS NOT NULL THEN
    RETURN v_exp;
  END IF;

  RETURN public.generar_expediente(_tipo_op);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolver_expediente_por_bl(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.resolver_expediente_por_bl(text, text) TO authenticated, service_role;

-- 3) generar_expediente(text): defensa en profundidad — si por reasignación manual
--    o carrera el folio candidato ya existe, avanza la secuencia hasta uno libre.
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefijo     text;
  consecutivo bigint;
  v_exp       text;
  v_intentos  int := 0;
BEGIN
  CASE tipo_op
    WHEN 'Importación' THEN prefijo := 'IMP';
    WHEN 'Exportación' THEN prefijo := 'EXP';
    WHEN 'Nacional'    THEN prefijo := 'NAC';
    ELSE prefijo := 'GEN';
  END CASE;

  LOOP
    consecutivo := nextval('public.embarque_consecutivo_seq');
    v_exp := 'EL' || prefijo || lpad(consecutivo::text, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
        FROM public.embarques
       WHERE expediente = v_exp
         AND deleted_at IS NULL
    );

    v_intentos := v_intentos + 1;
    IF v_intentos > 1000 THEN
      RAISE EXCEPTION 'No se pudo generar un expediente único tras 1000 intentos';
    END IF;
  END LOOP;

  RETURN v_exp;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(text) TO authenticated, service_role;

-- El overload por enum sigue delegando en el text; se re-declara para asegurar consistencia.
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.generar_expediente(tipo_op::text); $$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) TO authenticated, service_role;
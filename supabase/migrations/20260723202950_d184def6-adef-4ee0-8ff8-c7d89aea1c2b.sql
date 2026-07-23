
-- Restaurar overload de texto (eliminado por R4-08) con la lógica atómica per-org.
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org       uuid;
  v_prefijo   text;
  v_consec    bigint;
  v_exp       text;
  v_intentos  int := 0;
BEGIN
  v_org := public.current_user_org_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No hay organización activa para generar expediente';
  END IF;

  CASE tipo_op
    WHEN 'Importación' THEN v_prefijo := 'IMP';
    WHEN 'Exportación' THEN v_prefijo := 'EXP';
    WHEN 'Nacional'    THEN v_prefijo := 'NAC';
    ELSE                    v_prefijo := 'GEN';
  END CASE;

  LOOP
    INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
    VALUES (v_org, 'embarque', 1)
    ON CONFLICT (organization_id, tipo)
    DO UPDATE SET ultimo_numero = public.folio_secuencias.ultimo_numero + 1,
                  updated_at    = now()
    RETURNING ultimo_numero INTO v_consec;

    v_exp := 'EL' || v_prefijo || lpad(v_consec::text, 5, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.embarques
       WHERE expediente = v_exp
         AND organization_id = v_org
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

-- El overload por enum queda delegando al de texto (ya existente).
CREATE OR REPLACE FUNCTION public.generar_expediente(tipo_op public.tipo_operacion)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.generar_expediente(tipo_op::text); $$;

REVOKE EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.generar_expediente(public.tipo_operacion) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._assert_receptor_fiscal_valido(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v public.clientes%ROWTYPE;
  v_faltantes text[] := ARRAY[]::text[];
  v_cp text;
BEGIN
  SELECT * INTO v FROM public.clientes WHERE id = p_cliente_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe' USING ERRCODE = 'P0002';
  END IF;

  IF btrim(COALESCE(v.nombre, '')) = '' THEN
    v_faltantes := v_faltantes || 'razón social';
  END IF;
  IF NOT public._rfc_valido(v.rfc, false) THEN
    RAISE EXCEPTION 'LC_REFACT_RFC_INVALIDO: el RFC del receptor (%) no tiene formato válido del SAT o es genérico',
      COALESCE(v.rfc, '(vacío)') USING ERRCODE = 'P0001';
  END IF;
  IF btrim(COALESCE(v.regimen_fiscal, '')) = '' THEN
    v_faltantes := v_faltantes || 'régimen fiscal';
  END IF;
  v_cp := btrim(COALESCE(NULLIF(btrim(COALESCE(v.codigo_postal, '')), ''), COALESCE(v.cp, '')));
  IF v_cp !~ '^[0-9]{5}$' THEN
    v_faltantes := v_faltantes || 'código postal (5 dígitos)';
  END IF;

  IF array_length(v_faltantes, 1) > 0 THEN
    RAISE EXCEPTION 'LC_REFACT_RECEPTOR_INCOMPLETO: faltan datos fiscales del receptor: %',
      array_to_string(v_faltantes, ', ') USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_receptor_fiscal_valido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_receptor_fiscal_valido(uuid) TO authenticated, service_role;

-- 3) Abrir caso: exige receptor fiscalmente completo.

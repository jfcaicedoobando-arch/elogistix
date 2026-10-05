-- AUD75: contar sólo facturas con saldo canónico positivo.
-- Mantiene estados, ACL, exposición MXN y validación de TC del contrato existente.
CREATE OR REPLACE FUNCTION public.get_exposicion_credito_cliente(p_cliente_id uuid)
 RETURNS TABLE(cliente_id uuid, organization_id uuid, dias_credito integer, limite_mxn numeric, en_uso_mxn numeric, disponible_mxn numeric, excedido boolean, facturas_vivas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_dias integer;
  v_limite numeric;
  v_en_uso numeric := 0;
  v_facturas integer := 0;
  v_malas text[] := ARRAY[]::text[];
  v_saldo numeric;
  v_total_malas integer;
  v_lista text;
  f record;
BEGIN
  SELECT c.organization_id, c.dias_credito, c.limite_credito_mxn
    INTO v_org, v_dias, v_limite
  FROM public.clientes c
  WHERE c.id = p_cliente_id
    AND c.deleted_at IS NULL
    AND (
      c.organization_id = public.current_user_org_id()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    );

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cliente no encontrado o sin acceso'
      USING ERRCODE = '42501';
  END IF;

  FOR f IN
    SELECT fa.id, fa.numero,
           fa.moneda::text AS moneda, fa.tipo_cambio AS tc
      FROM public.facturas fa
     WHERE fa.cliente_id = p_cliente_id
       AND fa.deleted_at IS NULL
       AND fa.estado IN ('Emitida','Vencida','Parcialmente pagada','Pagada')
  LOOP
    v_saldo := GREATEST(0, public.saldo_factura(f.id));
    IF v_saldo <= 0 THEN
      CONTINUE;
    END IF;
    v_facturas := v_facturas + 1;

    IF f.moneda = 'MXN' THEN
      v_en_uso := v_en_uso + v_saldo;
    ELSIF v_saldo > 0 THEN
      IF f.tc IS NULL OR f.tc < 5 OR f.tc > 40 THEN
        v_malas := array_append(v_malas, COALESCE(NULLIF(btrim(f.numero), ''), f.id::text));
      ELSE
        v_en_uso := v_en_uso + (v_saldo * f.tc);
      END IF;
    END IF;
  END LOOP;

  v_total_malas := COALESCE(array_length(v_malas, 1), 0);
  IF v_total_malas > 0 THEN
    v_lista := array_to_string(v_malas[1:10], ', ');
    IF v_total_malas > 10 THEN
      v_lista := v_lista || format(' y %s más', v_total_malas - 10);
    END IF;
    RAISE EXCEPTION 'LC_CREDITO_TC_INVALIDO: corrige el tipo de cambio de la(s) factura(s) en moneda extranjera %; sin él no se puede calcular la exposición de crédito.',
      v_lista
      USING ERRCODE = '22023';
  END IF;

  cliente_id      := p_cliente_id;
  organization_id := v_org;
  dias_credito    := v_dias;
  limite_mxn      := v_limite;
  en_uso_mxn      := ROUND(v_en_uso, 2);
  disponible_mxn  := CASE WHEN v_limite IS NULL THEN NULL ELSE ROUND(v_limite - v_en_uso, 2) END;
  excedido        := CASE WHEN v_limite IS NULL THEN false ELSE v_en_uso > v_limite END;
  facturas_vivas  := v_facturas;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exposicion_credito_cliente(uuid) TO service_role;

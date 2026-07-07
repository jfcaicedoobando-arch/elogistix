
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS email_destinatarios_default text[];

DROP FUNCTION IF EXISTS public.obtener_defaults_facturacion_cliente(uuid);

CREATE OR REPLACE FUNCTION public.obtener_defaults_facturacion_cliente(p_cliente_id uuid)
RETURNS TABLE(
  uso_cfdi text,
  forma_pago text,
  metodo_pago text,
  cc_emails text[],
  destinatarios_emails text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_cli_uso text;
  v_cli_forma text;
  v_cli_metodo text;
  v_cli_cc text[];
  v_cli_dest text[];
  v_last_uso text;
  v_last_forma text;
  v_last_metodo text;
  v_last_cc text[];
  v_last_dest text[];
BEGIN
  SELECT c.organization_id, c.uso_cfdi_default, c.forma_pago_default, c.metodo_pago_default,
         c.email_cc_default, c.email_destinatarios_default
    INTO v_org, v_cli_uso, v_cli_forma, v_cli_metodo, v_cli_cc, v_cli_dest
  FROM public.clientes c
  WHERE c.id = p_cliente_id;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = v_org AND om.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  SELECT f.uso_cfdi, f.forma_pago, f.metodo_pago
    INTO v_last_uso, v_last_forma, v_last_metodo
  FROM public.facturas f
  WHERE f.cliente_id = p_cliente_id
    AND f.organization_id = v_org
    AND f.uuid_fiscal IS NOT NULL
  ORDER BY f.fecha_emision DESC NULLS LAST, f.created_at DESC
  LIMIT 1;

  SELECT fe.cc
    INTO v_last_cc
  FROM public.factura_envios fe
  JOIN public.facturas f ON f.id = fe.factura_id
  WHERE f.cliente_id = p_cliente_id
    AND fe.organization_id = v_org
    AND fe.estado = 'enviado'
  ORDER BY fe.created_at DESC
  LIMIT 1;

  SELECT ARRAY(
    SELECT DISTINCT lower(d->>'email')
    FROM public.factura_envios fe
    JOIN public.facturas f ON f.id = fe.factura_id
    CROSS JOIN LATERAL jsonb_array_elements(fe.destinatarios) d
    WHERE f.cliente_id = p_cliente_id
      AND fe.organization_id = v_org
      AND fe.estado = 'enviado'
      AND fe.created_at = (
        SELECT max(fe2.created_at)
        FROM public.factura_envios fe2
        JOIN public.facturas f2 ON f2.id = fe2.factura_id
        WHERE f2.cliente_id = p_cliente_id
          AND fe2.organization_id = v_org
          AND fe2.estado = 'enviado'
      )
      AND (d->>'email') IS NOT NULL
      AND lower(d->>'email') NOT IN (
        SELECT lower(cc.email) FROM public.contactos_cliente cc
        WHERE cc.cliente_id = p_cliente_id AND cc.email IS NOT NULL
      )
      AND lower(d->>'email') NOT IN (
        SELECT lower(cli.email) FROM public.clientes cli
        WHERE cli.id = p_cliente_id AND cli.email IS NOT NULL
      )
  ) INTO v_last_dest;

  uso_cfdi := COALESCE(v_cli_uso, v_last_uso);
  forma_pago := COALESCE(v_cli_forma, v_last_forma);
  metodo_pago := COALESCE(v_cli_metodo, v_last_metodo);
  cc_emails := COALESCE(v_cli_cc, v_last_cc);
  destinatarios_emails := COALESCE(v_cli_dest, NULLIF(v_last_dest, ARRAY[]::text[]));
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_defaults_facturacion_cliente(uuid) TO authenticated;

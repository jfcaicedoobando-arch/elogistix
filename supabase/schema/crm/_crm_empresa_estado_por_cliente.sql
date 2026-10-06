CREATE OR REPLACE FUNCTION public._crm_empresa_estado_por_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN NEW.estado_crm := 'Cliente'; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_estado_por_cliente() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_estado_por_cliente() TO service_role;

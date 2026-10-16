CREATE OR REPLACE FUNCTION public._crm_empresa_no_borrar_cliente()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL
     AND (OLD.cliente_id IS NOT NULL OR OLD.estado_crm = 'Cliente') THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_ES_CLIENTE: una empresa que ya es cliente no se puede eliminar'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_no_borrar_cliente() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_crm_empresa_no_borrar_cliente ON public.crm_empresas;
CREATE TRIGGER trg_crm_empresa_no_borrar_cliente
BEFORE UPDATE OF deleted_at ON public.crm_empresas
FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_no_borrar_cliente();
CREATE OR REPLACE FUNCTION public._crm_empresa_no_delete_fisico()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.cliente_id IS NOT NULL OR OLD.estado_crm = 'Cliente' THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_ES_CLIENTE: una empresa que ya es cliente no se puede eliminar'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_no_delete_fisico() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_crm_empresa_no_delete_fisico ON public.crm_empresas;
CREATE TRIGGER trg_crm_empresa_no_delete_fisico
BEFORE DELETE ON public.crm_empresas
FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_no_delete_fisico();
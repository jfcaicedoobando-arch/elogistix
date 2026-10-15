-- Cada cliente nuevo obtiene su empresa CRM (estado Cliente). Si ya existe una
-- empresa sin cliente con el mismo nombre en la org, se liga en vez de duplicar.
CREATE OR REPLACE FUNCTION public._crm_empresa_desde_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_emp uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.crm_empresas
              WHERE cliente_id = NEW.id AND deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_emp FROM public.crm_empresas
   WHERE organization_id = NEW.organization_id AND deleted_at IS NULL
     AND cliente_id IS NULL AND upper(btrim(nombre)) = upper(btrim(NEW.nombre))
   ORDER BY created_at LIMIT 1;
  IF v_emp IS NOT NULL THEN
    UPDATE public.crm_empresas SET cliente_id = NEW.id WHERE id = v_emp;
  ELSE
    INSERT INTO public.crm_empresas (organization_id, nombre, cliente_id, created_by)
    VALUES (NEW.organization_id, NEW.nombre, NEW.id, auth.uid());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_desde_cliente() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_desde_cliente() TO service_role;
DROP TRIGGER IF EXISTS trg_clientes_crm_empresa ON public.clientes;
CREATE TRIGGER trg_clientes_crm_empresa
AFTER INSERT ON public.clientes
FOR EACH ROW WHEN (NEW.deleted_at IS NULL)
EXECUTE FUNCTION public._crm_empresa_desde_cliente();
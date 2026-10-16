CREATE OR REPLACE FUNCTION public._crm_empresa_desde_cliente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  -- Un alta independiente no aporta identidad CRM: cada cliente obtiene la suya.
  -- La conversión reserva su UUID en la empresa exacta antes de insertar el cliente.
  IF EXISTS (SELECT 1 FROM public.crm_empresas
              WHERE organization_id = NEW.organization_id
                AND cliente_id = NEW.id AND deleted_at IS NULL) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.crm_empresas (organization_id, nombre, cliente_id, created_by)
  VALUES (NEW.organization_id, NEW.nombre, NEW.id, auth.uid());
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_desde_cliente() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_desde_cliente() TO service_role;
CREATE OR REPLACE TRIGGER trg_clientes_crm_empresa
AFTER INSERT ON public.clientes
FOR EACH ROW WHEN (NEW.deleted_at IS NULL)
EXECUTE FUNCTION public._crm_empresa_desde_cliente();

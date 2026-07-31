-- Promoción vía conceptos de costo vinculados a facturas de proveedor.
CREATE OR REPLACE FUNCTION public._trg_promover_por_liquidar_pfc()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_embarque_id uuid;
BEGIN
  SELECT cc.embarque_id INTO v_embarque_id
    FROM conceptos_costo cc
   WHERE cc.id = COALESCE(NEW.concepto_costo_id, OLD.concepto_costo_id);

  BEGIN
    PERFORM public.promover_embarque_por_liquidar(v_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._trg_promover_por_liquidar_pfc() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._trg_promover_por_liquidar_pfc() FROM anon;
GRANT EXECUTE ON FUNCTION public._trg_promover_por_liquidar_pfc() TO authenticated;
GRANT EXECUTE ON FUNCTION public._trg_promover_por_liquidar_pfc() TO service_role;

DROP TRIGGER IF EXISTS trg_pfc_promover_por_liquidar ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_pfc_promover_por_liquidar
AFTER INSERT OR UPDATE OR DELETE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public._trg_promover_por_liquidar_pfc();

DROP TRIGGER IF EXISTS trg_entrantes_promover_por_liquidar ON public.embarque_facturas_entrantes;
CREATE TRIGGER trg_entrantes_promover_por_liquidar
AFTER INSERT OR UPDATE ON public.embarque_facturas_entrantes
FOR EACH ROW EXECUTE FUNCTION public._trg_promover_por_liquidar();
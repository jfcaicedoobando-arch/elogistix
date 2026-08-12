-- FIX BL-03 (auditoría BL/BD): siguiente_folio_proveedor(p_org_id) era ejecutable
-- por cualquier usuario autenticado sobre cualquier organization_id (SECURITY
-- DEFINER + GRANT a authenticated sin verificación de membresía), permitiendo
-- quemar la secuencia FP- de otra organización. Se añade guard de membresía con
-- el patrón del repo (reactivar_cotizacion_rpc): auth.uid() NULL (service_role /
-- llamadas internas definer) queda fuera del guard.
CREATE OR REPLACE FUNCTION public.siguiente_folio_proveedor(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
BEGIN
  -- FIX BL-03: solo miembros de la organización (o super_admin, incluido en
  -- is_org_member) pueden consumir la secuencia de folios FP-.
  IF auth.uid() IS NOT NULL AND NOT public.is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (p_org_id, 'factura_proveedor', 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;

  RETURN 'FP-' || lpad(v_num::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.siguiente_folio_proveedor(uuid) TO authenticated, service_role;

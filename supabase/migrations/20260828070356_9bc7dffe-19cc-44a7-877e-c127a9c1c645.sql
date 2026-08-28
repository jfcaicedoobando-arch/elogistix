-- ===========================================================================
-- Ola E2 · Sub-ola B — C9: alinear la lectura de costos de cotización con la
-- decisión de producto: el rol `vendedor` ve costos SÓLO de SUS cotizaciones.
--
-- Antes `puede_ver_costos_cotizacion` incluía a `vendedor` sin condición, así
-- que cualquier vendedor podía leer por API el costo y el margen de las
-- cotizaciones de sus compañeros.
-- ===========================================================================

-- 1) La función de rol deja de incluir `vendedor` (los demás roles no cambian).
CREATE OR REPLACE FUNCTION public.puede_ver_costos_cotizacion(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin','gerente_comercial','gerente_visor',
          'gerente_operaciones','ejecutivo_pricing','coordinador_logistico',
          'operador','customer_service','contador','tesorero','auxiliar_contable']::app_role[]
  );
$$;

REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion(uuid) TO service_role;

-- 2) Nueva función: vendedor sobre SU propia cotización (misma organización).
CREATE OR REPLACE FUNCTION public.puede_ver_costos_cotizacion_propia(
  _cotizacion_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _user_id IS NOT NULL
     AND _cotizacion_id IS NOT NULL
     AND public.has_any_role_efectivo(_user_id, ARRAY['vendedor']::app_role[])
     AND EXISTS (
       SELECT 1
       FROM public.cotizaciones c
       WHERE c.id = _cotizacion_id
         AND c.created_by = _user_id
         AND c.organization_id = public.current_user_org_id()
     );
$$;

REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_costos_cotizacion_propia(uuid, uuid) TO service_role;

-- 3) Política SELECT de cotizacion_costos: rol amplio O vendedor dueño.
DROP POLICY IF EXISTS "Tenant read cotizacion_costos" ON public.cotizacion_costos;

CREATE POLICY "Tenant read cotizacion_costos"
ON public.cotizacion_costos FOR SELECT TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (
    (SELECT public.puede_ver_costos_cotizacion((SELECT auth.uid())))
    OR public.puede_ver_costos_cotizacion_propia(cotizacion_id, (SELECT auth.uid()))
  )
);

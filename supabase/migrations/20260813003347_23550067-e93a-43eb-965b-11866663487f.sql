-- Alineación de permisos de escritura en cotizaciones (v13.554.0).
-- Antes: la política exigía admin/operador/ejecutivo_pricing, por lo que un
-- gerente_comercial (rol de ventas que en la UI SÍ puede gestionar cotizaciones)
-- recibía "Permisos insuficientes" desde la base de datos. Se centraliza la
-- lista de roles en una función para que UI y BD no se desincronicen otra vez.

CREATE OR REPLACE FUNCTION public.puede_escribir_cotizaciones(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'operador'::app_role)
    OR public.has_role(_user_id, 'ejecutivo_pricing'::app_role)
    OR public.has_role(_user_id, 'gerente_comercial'::app_role)
    OR public.has_role(_user_id, 'super_admin'::app_role)
  )
$$;

-- H6: superficie mínima de ejecución.
REVOKE ALL ON FUNCTION public.puede_escribir_cotizaciones(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.puede_escribir_cotizaciones(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_escribir_cotizaciones(uuid) TO service_role;

COMMENT ON FUNCTION public.puede_escribir_cotizaciones(uuid) IS
  'Roles con escritura en cotizaciones y sus costos. Espejo de SALES/OPERATIONS en src/lib/access/permissionMatrix.ts.';

-- Políticas de escritura: mismo aislamiento por organización, roles centralizados.
DROP POLICY IF EXISTS "Tenant CRUD cotizaciones" ON public.cotizaciones;
CREATE POLICY "Tenant CRUD cotizaciones"
ON public.cotizaciones
FOR ALL
TO authenticated
USING (
  (organization_id = (SELECT public.current_user_org_id())
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
)
WITH CHECK (
  (organization_id = (SELECT public.current_user_org_id())
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
);

DROP POLICY IF EXISTS "Tenant CRUD cotizacion_costos" ON public.cotizacion_costos;
CREATE POLICY "Tenant CRUD cotizacion_costos"
ON public.cotizacion_costos
FOR ALL
TO authenticated
USING (
  (organization_id = (SELECT public.current_user_org_id())
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
)
WITH CHECK (
  (organization_id = (SELECT public.current_user_org_id())
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND (SELECT public.puede_escribir_cotizaciones((SELECT auth.uid())))
);

-- Guardia usada por las RPC de cotización (enviar, aceptar, versionar).
CREATE OR REPLACE FUNCTION public._assert_writer_cotizacion(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF NOT v_super AND (v_org IS NULL OR p_org IS NULL) THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    v_super
    OR (p_org = v_org AND public.puede_escribir_cotizaciones(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_writer_cotizacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_writer_cotizacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._assert_writer_cotizacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._assert_writer_cotizacion(uuid) TO service_role;
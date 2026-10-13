-- 13.824.75: privilegios mínimos de cinco catálogos globales.
-- Payload canónico para replay transaccional; no incluye registro de ledger.
-- Aplicación remota sólo mediante envelope fail-closed revisado y aprobación específica.

-- anon no tiene políticas aplicables. Se retiran ocho privilegios de tabla.
REVOKE ALL PRIVILEGES ON TABLE
  public.planes,
  public.navieras,
  public.puertos,
  public.tipos_contenedor,
  public.tipos_cambio_dof
FROM anon;

-- Mantener SELECT/INSERT/UPDATE/DELETE para la administración RLS existente.
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLE
  public.planes,
  public.navieras,
  public.puertos,
  public.tipos_contenedor,
  public.tipos_cambio_dof
FROM authenticated;

-- DOF se escribe mediante cron service_role o RPC SECURITY DEFINER con guard.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.tipos_cambio_dof
FROM authenticated;

-- ALTER conserva la política ALL separada del super_admin y su OR permisivo.
ALTER POLICY "Authenticated read planes" ON public.planes
  USING (activo IS TRUE);

-- Espejo de la corrección aplicada en vivo (auditoría v13.823.143 · bug 5):
-- `arribos_mes` en dashboard_summary_datos() deja de contar embarques Borrador
-- usando la CTE `activos` en lugar de `embarques_base`.
DO $mig$
DECLARE
  def text;
BEGIN
  def := pg_get_functiondef('public.dashboard_summary_datos()'::regprocedure);
  IF position('FROM embarques_base eb' in def) > 0 THEN
    def := replace(def, 'FROM embarques_base eb', 'FROM activos eb');
    EXECUTE def;
  END IF;
END
$mig$;

REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary_datos() TO service_role;

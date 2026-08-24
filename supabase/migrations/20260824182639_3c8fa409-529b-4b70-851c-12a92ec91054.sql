-- FIX-R3-02: cron_locks tenía RLS habilitada y CERO policies (deny implícito),
-- lo que rompe el verificador de cobertura RLS de CI. Declaramos el deny de
-- forma explícita: service_role (los crons) hace bypass de RLS, así que el
-- comportamiento no cambia.
DROP POLICY IF EXISTS "cron_locks sin acceso desde la app" ON public.cron_locks;
CREATE POLICY "cron_locks sin acceso desde la app"
  ON public.cron_locks
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.cron_locks FROM anon, authenticated;
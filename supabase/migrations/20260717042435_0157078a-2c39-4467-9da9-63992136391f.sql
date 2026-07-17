
-- ============================================================
-- H1: idempotency_keys — políticas scopeadas por organización
-- ============================================================
DROP POLICY IF EXISTS "Tenant insert own idempotency_keys" ON public.idempotency_keys;
DROP POLICY IF EXISTS "Tenant read own idempotency_keys" ON public.idempotency_keys;

CREATE POLICY "Tenant read scoped idempotency_keys"
  ON public.idempotency_keys
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND (
      user_id = auth.uid()
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE POLICY "Tenant insert scoped idempotency_keys"
  ON public.idempotency_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = public.current_user_org_id()
  );

CREATE POLICY "Tenant update scoped idempotency_keys"
  ON public.idempotency_keys
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND organization_id = public.current_user_org_id()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = public.current_user_org_id()
  );

-- ============================================================
-- H2: DROP tablas _backup_* (limpieza)
-- ============================================================
DROP TABLE IF EXISTS public._backup_backfill_proformas_20260706 CASCADE;
DROP TABLE IF EXISTS public._backup_gap_externo_proformas_20260706 CASCADE;
DROP TABLE IF EXISTS public._backup_gap_externo_proformas_20260706_lote2 CASCADE;
DROP TABLE IF EXISTS public._backup_merge_client_users_20260706 CASCADE;
DROP TABLE IF EXISTS public._backup_merge_clientes_20260706 CASCADE;
DROP TABLE IF EXISTS public._backup_merge_embarques_20260602 CASCADE;
DROP TABLE IF EXISTS public._backup_merge_fk_remap_20260602 CASCADE;

-- ============================================================
-- H3: TO public -> TO service_role en policies de service_role
-- ============================================================

-- email_send_log
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
CREATE POLICY "Service role can read send log"
  ON public.email_send_log
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can update send log"
  ON public.email_send_log
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- email_send_state
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state"
  ON public.email_send_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- email_unsubscribe_tokens
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can read tokens"
  ON public.email_unsubscribe_tokens
  FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can mark tokens as used"
  ON public.email_unsubscribe_tokens
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- suppressed_emails
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can read suppressed emails"
  ON public.suppressed_emails
  FOR SELECT
  TO service_role
  USING (true);

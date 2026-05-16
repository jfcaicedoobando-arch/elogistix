-- A.3 debug audit: track hits and expose admin RPC
ALTER TABLE public.idempotency_keys
  ADD COLUMN IF NOT EXISTS hits integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_idem_org_created
  ON public.idempotency_keys(organization_id, created_at DESC);

-- Rewrite claim: increments hits on conflict using xmax trick to distinguish insert vs update.
CREATE OR REPLACE FUNCTION public.idempotency_claim(_key uuid, _fn text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted boolean;
  v_existing jsonb;
  v_org uuid;
BEGIN
  IF _key IS NULL THEN RETURN NULL; END IF;
  v_org := current_user_org_id();
  INSERT INTO public.idempotency_keys(key, organization_id, user_id, fn, hits)
  VALUES (_key, COALESCE(v_org, '00000000-0000-0000-0000-000000000000'::uuid), auth.uid(), _fn, 0)
  ON CONFLICT (key) DO UPDATE SET hits = public.idempotency_keys.hits + 1
  RETURNING (xmax = 0), response INTO v_inserted, v_existing;
  IF v_inserted THEN RETURN NULL; END IF;
  RETURN COALESCE(v_existing, jsonb_build_object('__idempotency_pending', true));
END;
$$;

-- Admin audit list: returns recent idempotency claims for the caller's org (super_admin sees all).
CREATE OR REPLACE FUNCTION public.list_idempotency_log(_limit int DEFAULT 100, _offset int DEFAULT 0)
RETURNS TABLE (
  key uuid,
  fn text,
  hits integer,
  created_at timestamptz,
  user_id uuid,
  user_email text,
  has_response boolean,
  pending boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := current_user_org_id();
  v_is_super boolean := has_role(auth.uid(), 'super_admin'::app_role);
  v_is_admin boolean := has_role(auth.uid(), 'admin'::app_role) OR v_is_super;
BEGIN
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Forbidden: requires admin role';
  END IF;
  RETURN QUERY
  SELECT
    ik.key,
    ik.fn,
    ik.hits,
    ik.created_at,
    ik.user_id,
    u.email::text AS user_email,
    (ik.response IS NOT NULL AND NOT COALESCE((ik.response ? '__idempotency_pending'), false)) AS has_response,
    COALESCE((ik.response ? '__idempotency_pending'), ik.response IS NULL) AS pending
  FROM public.idempotency_keys ik
  LEFT JOIN auth.users u ON u.id = ik.user_id
  WHERE v_is_super OR ik.organization_id = v_org
  ORDER BY ik.created_at DESC
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
END;
$$;

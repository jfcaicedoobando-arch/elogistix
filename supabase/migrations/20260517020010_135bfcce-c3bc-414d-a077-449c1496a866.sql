CREATE OR REPLACE FUNCTION public.app_logs_health_summary(p_hours integer DEFAULT 24)
RETURNS TABLE (
  fn text,
  total bigint,
  errors bigint,
  warns bigint,
  p50_ms numeric,
  p95_ms numeric,
  last_ts timestamptz,
  last_error_ts timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.fn,
    count(*)::bigint AS total,
    count(*) FILTER (WHERE l.level = 'error')::bigint AS errors,
    count(*) FILTER (WHERE l.level = 'warn')::bigint AS warns,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY l.latency_ms)::numeric AS p50_ms,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY l.latency_ms)::numeric AS p95_ms,
    max(l.ts) AS last_ts,
    max(l.ts) FILTER (WHERE l.level = 'error') AS last_error_ts
  FROM public.app_logs l
  WHERE l.ts >= now() - make_interval(hours => greatest(p_hours, 1))
  GROUP BY l.fn
  ORDER BY errors DESC, total DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.app_logs_health_summary(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.app_logs_health_summary(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.app_logs_health_timeline(p_hours integer DEFAULT 24, p_buckets integer DEFAULT 24)
RETURNS TABLE (
  bucket timestamptz,
  total bigint,
  errors bigint,
  warns bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      greatest(p_hours, 1) AS hours,
      greatest(p_buckets, 1) AS buckets
  ),
  series AS (
    SELECT generate_series(
      date_trunc('minute', now()) - make_interval(hours => (SELECT hours FROM params)),
      date_trunc('minute', now()),
      make_interval(secs => ((SELECT hours FROM params) * 3600.0 / (SELECT buckets FROM params))::int)
    ) AS bucket
  )
  SELECT
    s.bucket,
    count(l.id)::bigint AS total,
    count(l.id) FILTER (WHERE l.level = 'error')::bigint AS errors,
    count(l.id) FILTER (WHERE l.level = 'warn')::bigint AS warns
  FROM series s
  LEFT JOIN public.app_logs l
    ON l.ts >= s.bucket
   AND l.ts <  s.bucket + make_interval(secs => ((SELECT hours FROM params) * 3600.0 / (SELECT buckets FROM params))::int)
  GROUP BY s.bucket
  ORDER BY s.bucket;
$$;

REVOKE EXECUTE ON FUNCTION public.app_logs_health_timeline(integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.app_logs_health_timeline(integer, integer) TO authenticated;
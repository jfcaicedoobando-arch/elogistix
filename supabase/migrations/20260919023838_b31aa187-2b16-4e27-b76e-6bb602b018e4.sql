ALTER TABLE public.facturapi_credenciales
  ADD COLUMN IF NOT EXISTS webhook_secret_sandbox text,
  ADD COLUMN IF NOT EXISTS webhook_secret_live text,
  ADD COLUMN IF NOT EXISTS webhook_id_sandbox text,
  ADD COLUMN IF NOT EXISTS webhook_id_live text,
  ADD COLUMN IF NOT EXISTS webhook_url_sandbox text,
  ADD COLUMN IF NOT EXISTS webhook_url_live text,
  ADD COLUMN IF NOT EXISTS webhook_eventos_sandbox text[],
  ADD COLUMN IF NOT EXISTS webhook_eventos_live text[],
  ADD COLUMN IF NOT EXISTS webhook_estado_sandbox text,
  ADD COLUMN IF NOT EXISTS webhook_estado_live text,
  ADD COLUMN IF NOT EXISTS webhook_verificado_sandbox_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_verificado_live_at timestamptz;

COMMENT ON COLUMN public.facturapi_credenciales.webhook_secret IS
  'LEGACY (P2 FacturAPI 5.0): secret indistinto por ambiente. Sólo respaldo de lectura mientras se migra; usar webhook_secret_sandbox / webhook_secret_live.';
COMMENT ON COLUMN public.facturapi_credenciales.webhook_secret_sandbox IS
  'Secret HMAC del webhook registrado en el ambiente SANDBOX de FacturAPI.';
COMMENT ON COLUMN public.facturapi_credenciales.webhook_secret_live IS
  'Secret HMAC del webhook registrado en el ambiente LIVE de FacturAPI.';
COMMENT ON COLUMN public.facturapi_credenciales.webhook_estado_sandbox IS
  'Diagnóstico de la última verificación remota en sandbox: ok | url_distinta | eventos_faltantes | inactivo | no_encontrado | error.';
COMMENT ON COLUMN public.facturapi_credenciales.webhook_estado_live IS
  'Diagnóstico de la última verificación remota en live: ok | url_distinta | eventos_faltantes | inactivo | no_encontrado | error.';

UPDATE public.facturapi_credenciales
   SET webhook_secret_live = webhook_secret
 WHERE webhook_secret IS NOT NULL
   AND webhook_secret_live IS NULL
   AND ambiente = 'live';

UPDATE public.facturapi_credenciales
   SET webhook_secret_sandbox = webhook_secret
 WHERE webhook_secret IS NOT NULL
   AND webhook_secret_sandbox IS NULL
   AND ambiente <> 'live';
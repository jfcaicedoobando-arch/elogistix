-- v13.777.9 · Paridad de GRANTs para replay desde cero.
-- Estas tablas ya tienen los privilegios estándar en la base real (heredados
-- del template original), pero ninguna migración los emitía, así que un replay
-- desde cero las dejaba inaccesibles para anon/authenticated y los guards de
-- RLS fallaban con "permission denied". La visibilidad real la sigue
-- gobernando RLS (política por organización), no el GRANT.
DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'alertas_sistema','app_logs','auditoria_comentarios','auditoria_revisiones',
    'auditoria_snapshots','bitacora_actividad','client_users','conceptos_costo',
    'conceptos_factura','conceptos_venta','configuracion','configuracion_global',
    'contactos_cliente','cotizacion_costos','cotizaciones','crm_actividades',
    'crm_comentarios_oportunidad','crm_cuotas_vendedor','crm_etapas_pipeline',
    'crm_leads','crm_motivos_perdida','crm_notificaciones','crm_oportunidades',
    'crm_plantillas_mensaje','cron_locks','demo_seed_state','documentos_embarque',
    'email_send_log','email_send_state','email_unsubscribe_tokens','embarques',
    'eventos_embarque','facturapi_webhook_eventos','facturas','idempotency_keys',
    'notas_embarque','notificaciones_cliente','organization_members','organizations',
    'planes','proforma_conceptos_consolidados','proformas','puertos',
    'ratelimit_buckets','suppressed_emails','tipos_contenedor','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;
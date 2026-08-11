-- ============================================================================
-- Migración: storage_buckets_infra_drift
-- Pendiente P2 de la re-auditoría 2026-08-12 (infra creada a mano → drift)
-- Pegar tal cual en Lovable / Supabase migrations. Idempotente.
-- ============================================================================

-- 1) Buckets privados que hoy solo existen por creación manual en dashboard.
--    ON CONFLICT fuerza public=false por si algún entorno los tiene públicos.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('cotizaciones-pdf',        'cotizaciones-pdf',        false),
  ('facturas-pdf',            'facturas-pdf',            false),
  ('cxp-inbox',               'cxp-inbox',               false),
  ('agente-cartas-garantia',  'agente-cartas-garantia',  false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2) Guardarraíl: si algún bucket referenciado en políticas no existiera en
--    este entorno, la migración falla aquí con mensaje claro en vez de dejar
--    políticas apuntando a buckets fantasma.
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY[
    'cotizaciones-pdf','facturas-pdf','cxp-inbox','agente-cartas-garantia',
    'documentos','facturas','reportes-feedback'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = b) THEN
      RAISE EXCEPTION 'Bucket requerido % no existe tras el upsert', b;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- NOTA SOBRE P3 (índices RLS) — NO INCLUIR ÍNDICES NUEVOS
-- ============================================================================
-- Verificación manual sobre el esquema real (migrations @ 741b509):
-- el pendiente P3 de la re-auditoría resultó ser un FALSO POSITIVO.
-- Todas las tablas listadas ya tienen un índice B-tree implícito con
-- organization_id como columna IZQUIERDA, vía PK o UNIQUE:
--
--   configuracion              UNIQUE (organization_id, categoria, clave)   20260620030723
--   folio_secuencias           PRIMARY KEY (organization_id, tipo)          20260622194026
--   presupuesto_categorias     UNIQUE (organization_id, nombre)
--   crm_cuotas_vendedor        UNIQUE (organization_id, vendedor_id, anio, mes)
--   crm_motivos_perdida        UNIQUE (organization_id, nombre)
--   facturapi_credenciales     PRIMARY KEY (organization_id)
--   vendedora_config           UNIQUE (organization_id, user_id)
--   costeo_agentes             UNIQUE (organization_id, nombre)
--   costeo_rutas               UNIQUE (organization_id, puerto_origen_id, puerto_destino_id)
--   costeo_navieras_condiciones UNIQUE (organization_id, naviera_id)
--   organization_members       UNIQUE(organization_id,user_id)
--                              + idx_org_members_user / idx_org_members_user_id / idx_org_members_org_id
--
-- Un CREATE INDEX adicional sobre (organization_id) sería redundante
-- (PostgreSQL usa el índice del constraint para el predicado org = ...).
-- La auditoría original los marcó por heurística ("no hay CREATE INDEX
-- explícito") sin contar los índices implícitos de constraints.
--
-- Verificación opcional en producción (correr una vez, esperar seq scans ≈ 0
-- en tablas grandes):
--   SELECT schemaname, relname, seq_scan, idx_scan
--   FROM pg_stat_user_tables
--   WHERE relname IN ('configuracion','folio_secuencias','presupuesto_categorias',
--                     'crm_cuotas_vendedor','costeo_agentes','costeo_rutas')
--   ORDER BY seq_scan DESC;
-- ============================================================================

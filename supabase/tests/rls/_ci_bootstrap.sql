-- ============================================================================
-- Bootstrap CI: stubs de Supabase para correr las migraciones contra un
-- Postgres vanilla (no GoTrue, sin schema auth pre-existente).
--
-- Se ejecuta ANTES del loop de migraciones. NO usar en Lovable Cloud — allí
-- `auth.*` ya existe y este archivo daría error.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS auth;

-- Tabla mínima auth.users — sólo las columnas a las que el código del proyecto
-- llega vía FK. GoTrue añade muchas más, no las necesitamos para RLS tests.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Stubs auth.uid()/jwt()/role() — leen `request.jwt.claims`.
-- Importante: `set_config('request.jwt.claims', NULL, true)` (usado por
-- `pg_temp.as_postgres()` para limpiar la sesión) NO deja la variable como
-- NULL sino como string vacío `''`. Hacer `''::jsonb` aborta con
-- "invalid input syntax for type json — input string ended unexpectedly",
-- lo que rompe cualquier INSERT que dispare un default basado en auth.uid()
-- después de un reset. `nullif(..., '')` blinda esto.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email', '')
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', 'anon')
$$;

-- Roles que las migraciones esperan (PostgREST/Supabase).
-- Definidos en un solo lugar: `_ci_roles.sql`. `\ir` resuelve la ruta relativa
-- al archivo que incluye, así que funciona sin importar el CWD de psql.
\ir _ci_roles.sql


GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- ============================================================================
-- Stubs de schema `storage` (Supabase Storage). Vanilla Postgres no lo trae.
-- Sólo las tablas a las que apuntan las migraciones (buckets + objects + policies).
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS storage;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  public boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id) ON DELETE CASCADE,
  name text,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz,
  metadata jsonb,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
);

-- Helper que algunas policies del proyecto pueden invocar.
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT string_to_array(name, '/')
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.buckets TO service_role;
GRANT ALL ON storage.objects TO service_role;
GRANT SELECT ON storage.buckets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;

-- ============================================================================
-- STUBS de extensiones managed-only de Supabase (pg_cron, pg_net, pgmq, vault).
-- Las migraciones de prod hacen CREATE EXTENSION + invocan funciones de esos
-- schemas. En el Postgres vanilla de CI no existen; el workflow filtra los
-- CREATE EXTENSION via sed y aquí dejamos las funciones como no-ops para que
-- los SELECT cron.schedule(...) / PERFORM pgmq.create(...) ejecuten sin error.
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS cron;
CREATE SCHEMA IF NOT EXISTS net;
CREATE SCHEMA IF NOT EXISTS pgmq;
CREATE SCHEMA IF NOT EXISTS vault;

-- Stub de la tabla cron.job — algunas migraciones consultan
-- `SELECT jobid FROM cron.job WHERE jobname = ...` para desprogramar por id.
CREATE TABLE IF NOT EXISTS cron.job (
  jobid   bigint PRIMARY KEY,
  jobname text UNIQUE,
  schedule text,
  command  text
);

CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

-- Overload por jobid (bigint) — usada por migraciones que primero leen
-- cron.job y luego desprograman por id numérico.
CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint)
RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;


CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, headers jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

CREATE OR REPLACE FUNCTION pgmq.create(queue_name text)
RETURNS void LANGUAGE sql AS $$ SELECT $1::void WHERE false; $$;

CREATE OR REPLACE FUNCTION pgmq.send(queue_name text, msg jsonb)
RETURNS bigint LANGUAGE sql AS $$ SELECT 0::bigint $$;

CREATE OR REPLACE FUNCTION pgmq.read(queue_name text, vt integer, qty integer)
RETURNS TABLE(msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
LANGUAGE sql AS $$ SELECT NULL::bigint, NULL::integer, NULL::timestamptz, NULL::timestamptz, NULL::jsonb WHERE false $$;

CREATE OR REPLACE FUNCTION pgmq.delete(queue_name text, msg_id bigint)
RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

GRANT USAGE ON SCHEMA cron, net, pgmq, vault TO anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- publication supabase_realtime
-- Existe por defecto en Supabase; en Postgres vanilla no. No es drift del
-- proyecto sino diferencia de plataforma → pertenece al bootstrap.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

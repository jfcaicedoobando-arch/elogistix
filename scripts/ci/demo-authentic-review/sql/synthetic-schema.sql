-- Synthetic empty-database table fixture; not full production schema equivalence.
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE public.organizations (id uuid PRIMARY KEY, activo boolean NOT NULL DEFAULT true);
INSERT INTO public.organizations VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');

CREATE TABLE public.clientes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations,
 nombre text NOT NULL, rfc text NOT NULL DEFAULT '',
 ciudad text NOT NULL DEFAULT '', estado text NOT NULL DEFAULT '',
 contacto text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
 telefono text NOT NULL DEFAULT '', dias_credito integer,
 deleted_at timestamptz, deleted_by uuid,
 UNIQUE (id, organization_id)
);
CREATE UNIQUE INDEX clientes_org_rfc_unique ON public.clientes
 (organization_id, upper(btrim(rfc)))
 WHERE rfc IS NOT NULL AND btrim(rfc) <> ''
   AND upper(btrim(rfc)) NOT IN ('XEXX010101000', 'XAXX010101000')
   AND deleted_at IS NULL;
CREATE TABLE public.contactos_cliente (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations,
 cliente_id uuid NOT NULL REFERENCES public.clientes ON DELETE CASCADE,
 nombre text NOT NULL, email text NOT NULL DEFAULT '', telefono text NOT NULL DEFAULT '',
 deleted_at timestamptz, deleted_by uuid
);
CREATE TABLE public.crm_empresas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL, nombre text NOT NULL, cliente_id uuid,
 created_by uuid, created_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz, estado_crm text NOT NULL DEFAULT 'Lead'
);
-- Same relevant runtime guards from the pinned baseline, plus literal trigger 0016.
\ir runtime-guards.sql
CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON public.clientes
 FOR EACH ROW EXECUTE FUNCTION public._guard_soft_delete();
CREATE TRIGGER trg_guard_soft_delete BEFORE UPDATE ON public.contactos_cliente
 FOR EACH ROW EXECUTE FUNCTION public._guard_soft_delete();
CREATE TRIGGER trg_clientes_email_unico BEFORE INSERT OR UPDATE OF email ON public.clientes
 FOR EACH ROW EXECUTE FUNCTION public._assert_email_unico_org();
CREATE TRIGGER trg_contactos_cliente_email_unico BEFORE INSERT OR UPDATE OF email ON public.contactos_cliente
 FOR EACH ROW EXECUTE FUNCTION public._assert_email_unico_org();
CREATE TRIGGER trg_clientes_normalizar_email BEFORE INSERT OR UPDATE OF email ON public.clientes
 FOR EACH ROW EXECUTE FUNCTION public._normalizar_email();
CREATE TRIGGER trg_contactos_cliente_normalizar_email BEFORE INSERT OR UPDATE OF email ON public.contactos_cliente
 FOR EACH ROW EXECUTE FUNCTION public._normalizar_email();

-- Literal 0016 function/trigger behavior, excluding ACL lines that require
-- application roles; this empty-db fixture never creates or changes roles.
\ir crm-trigger.sql

CREATE TABLE public.identity_test_insert_log (cliente_id uuid, deleted_at timestamptz);
CREATE FUNCTION public.identity_test_log() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.identity_test_insert_log VALUES (NEW.id, NEW.deleted_at);
 RETURN NEW;
END $$;
CREATE TRIGGER identity_test_log AFTER INSERT ON public.clientes
 FOR EACH ROW EXECUTE FUNCTION public.identity_test_log();

CREATE TABLE public.identity_test_references (
 cliente_id uuid REFERENCES public.clientes,
 contacto_id uuid REFERENCES public.contactos_cliente,
 empresa_id uuid REFERENCES public.crm_empresas,
 nota text NOT NULL
);

CREATE TABLE public.organization_members(user_id uuid REFERENCES auth.users,organization_id uuid REFERENCES public.organizations,role text);
CREATE TABLE public.user_roles(user_id uuid REFERENCES auth.users,role text);
CREATE TABLE public.presupuesto_categorias(id uuid PRIMARY KEY,organization_id uuid REFERENCES public.organizations,activa boolean,nombre text);
CREATE TABLE public.proveedores(id uuid PRIMARY KEY,organization_id uuid REFERENCES public.organizations,deleted_at timestamptz,estado_alta text,nombre text);
CREATE TABLE public.embarques(id uuid PRIMARY KEY,organization_id uuid REFERENCES public.organizations,deleted_at timestamptz,estado text,cliente_id uuid REFERENCES public.clientes,expediente text);
CREATE TABLE public.proveedor_facturas(id uuid PRIMARY KEY);
CREATE TABLE public.proveedor_facturas_conceptos(id uuid PRIMARY KEY);
CREATE TABLE public.pagos_proveedor(id uuid PRIMARY KEY);
INSERT INTO public.organizations VALUES('00000000-0000-4000-8000-000000000099',true);

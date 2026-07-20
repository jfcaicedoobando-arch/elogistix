-- v13.303.28: fusionar 'Proveedor' en 'Exportador' dentro del enum tipo_contacto.
UPDATE public.contactos_cliente SET tipo = 'Exportador' WHERE tipo = 'Proveedor';

ALTER TABLE public.contactos_cliente ALTER COLUMN tipo DROP DEFAULT;

ALTER TYPE public.tipo_contacto RENAME TO tipo_contacto_old;
CREATE TYPE public.tipo_contacto AS ENUM ('Exportador', 'Importador');
ALTER TABLE public.contactos_cliente
  ALTER COLUMN tipo TYPE public.tipo_contacto
  USING tipo::text::public.tipo_contacto;
ALTER TABLE public.contactos_cliente ALTER COLUMN tipo SET DEFAULT 'Exportador'::public.tipo_contacto;
DROP TYPE public.tipo_contacto_old;
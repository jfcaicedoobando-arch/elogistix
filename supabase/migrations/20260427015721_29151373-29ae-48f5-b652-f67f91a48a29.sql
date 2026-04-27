-- 1) Eliminar la política RLS que depende de la columna estado (la recreamos al final)
DROP POLICY IF EXISTS "Cliente read own cotizaciones" ON public.cotizaciones;

-- 2) Crear el nuevo enum sin 'Embarcada' y con 'En operación'
CREATE TYPE public.estado_cotizacion_new AS ENUM (
  'Borrador',
  'Enviada',
  'Confirmada',
  'Rechazada',
  'Vencida',
  'Aceptada',
  'En operación'
);

-- 3) Quitar el default temporalmente
ALTER TABLE public.cotizaciones ALTER COLUMN estado DROP DEFAULT;

-- 4) Migrar la columna mapeando 'Embarcada' → 'En operación'
ALTER TABLE public.cotizaciones
  ALTER COLUMN estado TYPE public.estado_cotizacion_new
  USING (
    CASE estado::text
      WHEN 'Embarcada' THEN 'En operación'
      ELSE estado::text
    END
  )::public.estado_cotizacion_new;

-- 5) Eliminar el enum viejo y renombrar el nuevo
DROP TYPE public.estado_cotizacion;
ALTER TYPE public.estado_cotizacion_new RENAME TO estado_cotizacion;

-- 6) Restaurar el default
ALTER TABLE public.cotizaciones
  ALTER COLUMN estado SET DEFAULT 'Borrador'::public.estado_cotizacion;

-- 7) Recrear la política RLS con el nuevo nombre del estado
CREATE POLICY "Cliente read own cotizaciones"
ON public.cotizaciones
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role)
  AND (cliente_id IN (SELECT current_user_client_ids()))
  AND (estado = ANY (ARRAY[
    'Enviada'::estado_cotizacion,
    'Aceptada'::estado_cotizacion,
    'Rechazada'::estado_cotizacion,
    'En operación'::estado_cotizacion
  ]))
);

-- 8) Actualizar el trigger de sincronización para que también promueva
--    Aceptada → En operación al vincular un embarque
CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cotizacion_id IS NOT NULL THEN
    UPDATE public.cotizaciones
    SET
      embarque_id = NEW.id,
      estado = CASE
        WHEN estado = 'Aceptada'::estado_cotizacion THEN 'En operación'::estado_cotizacion
        ELSE estado
      END,
      updated_at = now()
    WHERE id = NEW.cotizacion_id
      AND (embarque_id IS DISTINCT FROM NEW.id OR estado = 'Aceptada'::estado_cotizacion);
  END IF;
  RETURN NEW;
END;
$$;
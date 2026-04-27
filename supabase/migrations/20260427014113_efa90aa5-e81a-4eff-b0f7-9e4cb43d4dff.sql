DROP POLICY IF EXISTS "Cliente read own cotizaciones" ON public.cotizaciones;

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
    'Embarcada'::estado_cotizacion
  ]))
);
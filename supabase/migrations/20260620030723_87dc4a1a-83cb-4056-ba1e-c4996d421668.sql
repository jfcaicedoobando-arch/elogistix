
-- Hacer configuracion realmente por organización
-- 1. Cambiar la unicidad de (categoria, clave) a (organization_id, categoria, clave)
ALTER TABLE public.configuracion DROP CONSTRAINT IF EXISTS configuracion_categoria_clave_key;
ALTER TABLE public.configuracion
  ADD CONSTRAINT configuracion_org_categoria_clave_key UNIQUE (organization_id, categoria, clave);

-- 2. Sembrar los dos nuevos umbrales de reconciliación para cada organización (defaults 10% / 25%)
INSERT INTO public.configuracion (organization_id, categoria, clave, valor, descripcion)
SELECT o.id, 'operaciones', 'reconciliacion_varianza_alerta_pct', '10'::jsonb,
       'Umbral (%) a partir del cual la varianza Cotizado/Refrescado/Real se marca como alerta.'
FROM public.organizations o
ON CONFLICT (organization_id, categoria, clave) DO NOTHING;

INSERT INTO public.configuracion (organization_id, categoria, clave, valor, descripcion)
SELECT o.id, 'operaciones', 'reconciliacion_varianza_critica_pct', '25'::jsonb,
       'Umbral (%) a partir del cual la varianza Cotizado/Refrescado/Real se marca como crítica.'
FROM public.organizations o
ON CONFLICT (organization_id, categoria, clave) DO NOTHING;

-- 3. Asegurar aislamiento por org: reemplazar la política SELECT "USING (true)" por una filtrada por organización
DROP POLICY IF EXISTS "Autenticados pueden leer configuracion" ON public.configuracion;
CREATE POLICY "Miembros leen configuracion de su org"
ON public.configuracion
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

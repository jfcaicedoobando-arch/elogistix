ALTER TABLE public.cotizaciones ADD COLUMN tiempo_transito_dias integer;
ALTER TABLE public.cotizaciones ADD COLUMN frecuencia text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN ruta_texto text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN validez_propuesta date;
ALTER TABLE public.cotizaciones ADD COLUMN tipo_movimiento text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN seguro boolean NOT NULL DEFAULT false;
ALTER TABLE public.cotizaciones ADD COLUMN valor_seguro_usd numeric NOT NULL DEFAULT 0;
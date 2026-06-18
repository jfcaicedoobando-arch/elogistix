SET LOCAL app.bypass_cierre = 'on';

UPDATE public.embarques SET cotizacion_id = 'bdee6d48-8eed-4ca0-83d0-7df834fef513'
 WHERE id = '8d99f431-6b59-4221-8787-549445db904f' AND cotizacion_id IS NULL;

UPDATE public.embarques SET cotizacion_id = '99441f2b-cf15-4229-8c2f-248b547a8741'
 WHERE id = '646ee5ee-c1ad-4993-a9a7-f481b9b16830' AND cotizacion_id IS NULL;

UPDATE public.embarques SET cotizacion_id = 'c82a7e43-1de9-48eb-8e3f-8dd0d09dc73b'
 WHERE id = 'c42dfdbe-03dd-41c7-b87b-52bc59c099b3' AND cotizacion_id IS NULL;

UPDATE public.embarques SET cotizacion_id = '4adf064b-bbad-4d97-8764-57d78417b536'
 WHERE id = '2c57106c-a28e-4b50-b97e-d16d94d8ac10' AND cotizacion_id IS NULL;

UPDATE public.cotizaciones SET embarque_id = '8d99f431-6b59-4221-8787-549445db904f', updated_at = now()
 WHERE id = 'bdee6d48-8eed-4ca0-83d0-7df834fef513' AND embarque_id IS NULL;
UPDATE public.cotizaciones SET embarque_id = '646ee5ee-c1ad-4993-a9a7-f481b9b16830', updated_at = now()
 WHERE id = '99441f2b-cf15-4229-8c2f-248b547a8741' AND embarque_id IS NULL;
UPDATE public.cotizaciones SET embarque_id = 'c42dfdbe-03dd-41c7-b87b-52bc59c099b3', updated_at = now()
 WHERE id = 'c82a7e43-1de9-48eb-8e3f-8dd0d09dc73b' AND embarque_id IS NULL;
UPDATE public.cotizaciones SET embarque_id = '2c57106c-a28e-4b50-b97e-d16d94d8ac10', updated_at = now()
 WHERE id = '4adf064b-bbad-4d97-8764-57d78417b536' AND embarque_id IS NULL;
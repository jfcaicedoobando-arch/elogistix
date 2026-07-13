
UPDATE public.cotizaciones
SET conceptos_venta = jsonb_build_array(
  jsonb_build_object('descripcion','Flete Marítimo','moneda','USD','cantidad',1,'monto',200,'unidad_medida','contenedor'),
  jsonb_build_object('descripcion','Cargos en Destino (destino)','moneda','USD','cantidad',1,'monto',90,'unidad_medida','contenedor'),
  jsonb_build_object('descripcion','Flete Terrestre','moneda','USD','cantidad',1,'monto',1288,'unidad_medida','')
),
updated_at = now()
WHERE id = 'c5a10ecc-cdd9-4c7d-a22e-0b96b3202c16'
  AND (conceptos_venta IS NULL OR jsonb_array_length(conceptos_venta) = 0);

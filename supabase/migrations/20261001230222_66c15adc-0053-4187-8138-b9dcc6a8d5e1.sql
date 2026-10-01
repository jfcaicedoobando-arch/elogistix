WITH p(objeto, clave, etiqueta, tipo, orden) AS (VALUES
  ('empresa','fuente','Fuente','seleccion',1),
  ('empresa','tipo_transporte','Tipo de transporte','multiseleccion',2),
  ('empresa','rutas_principales','Rutas principales','texto',3),
  ('empresa','volumen_importacion_usd','Volumen de importación (USD)','numero',4),
  ('empresa','potencial_mensual_teus','Potencial mensual (TEUs)','numero',5),
  ('empresa','agente_propio','Tiene agente aduanal o transportista propio','seleccion',6),
  ('empresa','perfil_credito','Perfil de crédito','texto',7),
  ('contacto','puesto','Puesto','texto',1),
  ('contacto','nivel_decision','Nivel de decisión','seleccion',2),
  ('contacto','telefono_movil','Teléfono móvil','texto',3),
  ('contacto','telefono_fijo','Teléfono fijo','texto',4),
  ('contacto','linkedin','LinkedIn','texto',5),
  ('oportunidad','servicio','Servicio','texto',1),
  ('oportunidad','complejidad','Complejidad','seleccion',2),
  ('actividad','resultado','Resultado','texto',1),
  ('actividad','asistio_reunion','Asistió a la reunión','seleccion',2)
)
INSERT INTO public.crm_propiedades (objeto, clave, etiqueta, tipo, orden)
SELECT objeto, clave, etiqueta, tipo, orden FROM p
ON CONFLICT (objeto, clave) DO NOTHING;

WITH o(objeto, clave, etiqueta, orden) AS (VALUES
  ('empresa','fuente','Prospección',1),('empresa','fuente','Referido',2),('empresa','fuente','Referido Finkargo',3),
  ('empresa','tipo_transporte','Marítimo',1),('empresa','tipo_transporte','Aéreo',2),('empresa','tipo_transporte','Terrestre',3),
  ('empresa','agente_propio','Sí',1),('empresa','agente_propio','No',2),
  ('contacto','nivel_decision','Director',1),('contacto','nivel_decision','Gerente',2),('contacto','nivel_decision','Analista',3),
  ('oportunidad','complejidad','Estándar',1),('oportunidad','complejidad','Compleja',2),('oportunidad','complejidad','Especial',3),
  ('actividad','asistio_reunion','Sí',1),('actividad','asistio_reunion','No',2)
)
INSERT INTO public.crm_propiedad_opciones (propiedad_id, etiqueta, orden)
SELECT pr.id, o.etiqueta, o.orden
FROM o JOIN public.crm_propiedades pr ON pr.objeto = o.objeto AND pr.clave = o.clave
WHERE NOT EXISTS (
  SELECT 1 FROM public.crm_propiedad_opciones x WHERE x.propiedad_id = pr.id AND x.etiqueta = o.etiqueta
);
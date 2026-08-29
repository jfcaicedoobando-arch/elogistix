-- B-12 (v15): medidas negativas no deben poder guardarse por ninguna vía
-- (RPC, API o SQL directo). Se aplica como CHECK para que el candado no
-- dependa de que una futura redefinición de la RPC conserve la validación.
ALTER TABLE public.embarques
  ADD CONSTRAINT embarques_medidas_no_negativas
  CHECK (
    COALESCE(peso_kg, 0) >= 0
    AND COALESCE(volumen_m3, 0) >= 0
    AND COALESCE(piezas, 0) >= 0
  );

ALTER TABLE public.embarque_contenedores
  ADD CONSTRAINT embarque_contenedores_medidas_no_negativas
  CHECK (
    COALESCE(peso_kg, 0) >= 0
    AND COALESCE(volumen_m3, 0) >= 0
    AND COALESCE(piezas, 0) >= 0
  );
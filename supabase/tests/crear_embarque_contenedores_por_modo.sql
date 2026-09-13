-- Guard (v13.823.332 · BL-EMB-02 / FIN-EMB-03): `crear_embarque_borrador_core`
-- sólo debe insertar contenedores hijos cuando el modo es Marítimo. Antes se
-- insertaba al menos una fila para cualquier modo, así que Aéreo y Terrestre
-- nacían con un hijo vacío (numero/tipo '') que además contaminaba el prorrateo
-- de costos y encendía el badge "Datos pendientes" en la tabla de embarques.
--
-- Sólo lectura sobre pg_get_functiondef: no inserta datos, no requiere ROLLBACK.

DO $$
DECLARE
  v_def text;
BEGIN
  v_def := pg_get_functiondef('public.crear_embarque_borrador_core(uuid)'::regprocedure);

  -- El arreglo de destinos arranca vacío (Aéreo/Terrestre no prorratean por hijo).
  IF v_def !~ 'v_target_ids\s*:=\s*ARRAY\[\]::uuid\[\]' THEN
    RAISE EXCEPTION 'crear_embarque_borrador_core dejó de inicializar v_target_ids vacío';
  END IF;

  -- El INSERT de hijos vive dentro de la rama Marítimo.
  IF v_def !~ 'IF v_cot\.modo = ''Marítimo''::modo_transporte THEN\s*\n\s*IF v_tipo_servicio = ''LCL'' THEN' THEN
    RAISE EXCEPTION 'el alta de contenedores hijos ya no está condicionada al modo Marítimo';
  END IF;

  -- LCL sigue generando exactamente una fila consolidada.
  IF v_def !~ 'IF v_tipo_servicio = ''LCL'' THEN\s*\n\s*v_num := 1;' THEN
    RAISE EXCEPTION 'LCL dejó de generar exactamente un contenedor consolidado';
  END IF;

  -- El prorrateo sigue recibiendo el arreglo de hijos (vacío en no-marítimo).
  IF v_def !~ '_crear_embarque_replicar_conceptos\([^)]*v_target_ids' THEN
    RAISE EXCEPTION 'el prorrateo de conceptos dejó de recibir v_target_ids';
  END IF;

  RAISE NOTICE 'OK crear_embarque_contenedores_por_modo';
END $$;

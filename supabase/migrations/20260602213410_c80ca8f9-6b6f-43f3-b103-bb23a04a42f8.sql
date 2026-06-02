-- Unificación retroactiva de embarques duplicados (2do intento)
-- Bypass de triggers de usuario para permitir re-mapeo de FK en facturas/proformas congeladas

DO $migration$
DECLARE
  v_orfanos int;
  v_duplicados int;
  v_grupos int;
  v_hijos int;
BEGIN

  -- Desactiva triggers de usuario en esta transacción (FK y NOT NULL siguen activos)
  SET LOCAL session_replication_role = replica;

  CREATE TEMP TABLE _map ON COMMIT DROP AS
  WITH grp AS (
    SELECT id,
      first_value(id) OVER (
        PARTITION BY organization_id, expediente, cliente_id, COALESCE(bl_master,'')
        ORDER BY created_at, id
      ) AS padre_id
    FROM public.embarques WHERE deleted_at IS NULL
  )
  SELECT id AS hijo_id, padre_id FROM grp WHERE id <> padre_id;

  SELECT count(DISTINCT padre_id), count(*) INTO v_grupos, v_hijos FROM _map;
  RAISE NOTICE 'Unificación: % grupos, % embarques hijos a reapuntar', v_grupos, v_hijos;

  -- Backup completo de embarques que se borrarán
  CREATE TABLE IF NOT EXISTS public._backup_merge_embarques_20260602 AS
    SELECT e.*, m.padre_id AS _merge_padre_id, now() AS _merge_backed_up_at
    FROM public.embarques e JOIN _map m ON m.hijo_id = e.id WHERE 1=0;
  INSERT INTO public._backup_merge_embarques_20260602
    SELECT e.*, m.padre_id, now()
    FROM public.embarques e JOIN _map m ON m.hijo_id = e.id;

  -- Backup del mapeo FK por tabla hija
  CREATE TABLE IF NOT EXISTS public._backup_merge_fk_remap_20260602 (
    tabla text NOT NULL,
    fila_id uuid NOT NULL,
    embarque_id_anterior uuid NOT NULL,
    embarque_id_nuevo uuid NOT NULL,
    backed_up_at timestamptz NOT NULL DEFAULT now()
  );
  INSERT INTO public._backup_merge_fk_remap_20260602(tabla,fila_id,embarque_id_anterior,embarque_id_nuevo)
    SELECT 'embarque_contenedores', x.id, x.embarque_id, m.padre_id FROM public.embarque_contenedores x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'conceptos_costo', x.id, x.embarque_id, m.padre_id FROM public.conceptos_costo x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'conceptos_venta', x.id, x.embarque_id, m.padre_id FROM public.conceptos_venta x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'proformas', x.id, x.embarque_id, m.padre_id FROM public.proformas x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'facturas', x.id, x.embarque_id, m.padre_id FROM public.facturas x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'comisiones_devengadas', x.id, x.embarque_id, m.padre_id FROM public.comisiones_devengadas x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'documentos_embarque', x.id, x.embarque_id, m.padre_id FROM public.documentos_embarque x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'eventos_embarque', x.id, x.embarque_id, m.padre_id FROM public.eventos_embarque x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'notas_embarque', x.id, x.embarque_id, m.padre_id FROM public.notas_embarque x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'tracking_links', x.id, x.embarque_id, m.padre_id FROM public.tracking_links x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'tracking_externo', x.id, x.embarque_id, m.padre_id FROM public.tracking_externo x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'cotizaciones', x.id, x.embarque_id, m.padre_id FROM public.cotizaciones x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'auditoria_revisiones', x.id, x.embarque_id, m.padre_id FROM public.auditoria_revisiones x JOIN _map m ON m.hijo_id=x.embarque_id
    UNION ALL SELECT 'proforma_conceptos_consolidados', x.id, x.embarque_id, m.padre_id FROM public.proforma_conceptos_consolidados x JOIN _map m ON m.hijo_id=x.embarque_id;

  -- Sumar agregados al padre
  UPDATE public.embarques p SET
    peso_kg    = COALESCE(p.peso_kg,0)    + COALESCE(s.suma_peso,0),
    volumen_m3 = COALESCE(p.volumen_m3,0) + COALESCE(s.suma_vol,0),
    piezas     = COALESCE(p.piezas,0)     + COALESCE(s.suma_piezas,0),
    updated_at = now()
  FROM (
    SELECT m.padre_id,
           sum(e.peso_kg) AS suma_peso, sum(e.volumen_m3) AS suma_vol, sum(e.piezas) AS suma_piezas
    FROM public.embarques e JOIN _map m ON m.hijo_id = e.id
    GROUP BY m.padre_id
  ) s WHERE p.id = s.padre_id;

  -- Resolver duplicados en tracking_externo (UNIQUE embarque_id, provider)
  DELETE FROM public.tracking_externo t
  USING _map m, public.tracking_externo padre
  WHERE t.embarque_id = m.hijo_id
    AND padre.embarque_id = m.padre_id
    AND padre.provider = t.provider;

  -- UPDATE masivo en todas las tablas hijas
  UPDATE public.embarque_contenedores  ec SET embarque_id = m.padre_id FROM _map m WHERE ec.embarque_id = m.hijo_id;
  UPDATE public.conceptos_costo        x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.conceptos_venta        x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.proformas              x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.facturas               x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.comisiones_devengadas  x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.documentos_embarque    x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.eventos_embarque       x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.notas_embarque         x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.tracking_links         x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.tracking_externo       x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.cotizaciones           x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.auditoria_revisiones   x  SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id  = m.hijo_id;
  UPDATE public.proforma_conceptos_consolidados x SET embarque_id = m.padre_id FROM _map m WHERE x.embarque_id = m.hijo_id;

  -- Renumerar orden de contenedores del padre (1..N)
  WITH renumber AS (
    SELECT ec.id, row_number() OVER (PARTITION BY ec.embarque_id ORDER BY ec.created_at, ec.id) AS nuevo_orden
    FROM public.embarque_contenedores ec
    WHERE ec.embarque_id IN (SELECT DISTINCT padre_id FROM _map)
  )
  UPDATE public.embarque_contenedores ec SET orden = r.nuevo_orden FROM renumber r WHERE r.id = ec.id;

  -- Hard delete de hijos
  DELETE FROM public.embarques WHERE id IN (SELECT hijo_id FROM _map);

  -- Validación atómica
  SELECT count(*) INTO v_orfanos FROM public.embarques WHERE id IN (SELECT hijo_id FROM _map);
  SELECT count(*) INTO v_duplicados FROM (
    SELECT 1 FROM public.embarques WHERE deleted_at IS NULL
    GROUP BY organization_id, expediente, cliente_id, COALESCE(bl_master,'')
    HAVING count(*) > 1
  ) x;
  IF v_orfanos > 0 OR v_duplicados > 0 THEN
    RAISE EXCEPTION 'Validacion fallida: orfanos=%, duplicados=%', v_orfanos, v_duplicados;
  END IF;

  RAISE NOTICE 'Migración OK: % grupos unificados, % embarques eliminados', v_grupos, v_hijos;
END
$migration$;
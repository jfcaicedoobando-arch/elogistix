## Plan: Ampliar regla de fechas de descarga/devolución a cualquier embarque con contenedores

### Contexto
La regla `contenedores_fechas_completas` ya existe en el RPC `validar_cierre_embarque` y bloquea el cierre, pero está envuelta en `IF v_emb.modo='Marítimo' AND tipo_carga ILIKE 'FCL%'`. El embarque actual (`Carga General`) cae fuera del guard, así que la regla no aparece en su checklist.

### Cambios

**1. Migración SQL — `validar_cierre_embarque`**
- Sacar la validación de fechas (bloque "1b") fuera del `IF` de FCL.
- Nueva condición: aplicar si el embarque tiene **al menos 1 contenedor no eliminado**. Si no hay contenedores la regla se omite (no se agrega al checklist).
- La validación de **datos completos** (peso/volumen, bloque "1") se queda como está, sólo para FCL marítimo — el usuario no pidió moverla.

```text
IF EXISTS (SELECT 1 FROM embarque_contenedores
           WHERE embarque_id = p_embarque_id AND deleted_at IS NULL) THEN
  SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_cont_sin_fechas, v_cont_fechas_ids
  FROM embarque_contenedores
  WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
    AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
  v_ok := (v_cont_sin_fechas = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','contenedores_fechas_completas','ok',v_ok,
    'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
END IF;
```

**2. Sin cambios de frontend**
- `cierreCheckMeta.ts` ya tiene la entrada `contenedores_fechas_completas` con label, responsable (Operador) y CTA hacia el tab Resumen → contenedores. Sólo aparecerá en más embarques.

**3. Versionado + changelog**
- Bump a `v13.135.70`.
- Entrada en `CHANGELOG.md`: feat(embarques) — ampliar regla de fechas de descarga/devolución a cualquier embarque con contenedores (antes sólo FCL marítimo).

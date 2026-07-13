
# Prevenir folios de embarque duplicados

## Diagnóstico

Auditoría del flujo actual de generación de `expediente`:

1. **`generar_expediente(tipo_op)`** toma `nextval('embarque_consecutivo_seq')` y arma `EL<PREFIJO><5 dígitos>`. La secuencia es atómica, así que **por sí sola no puede producir duplicados**.
2. **`resolver_expediente_por_bl(_bl_master, _tipo_op)`** — usada al crear embarque desde documentos — busca cualquier embarque con el mismo `bl_master` y **reusa** su expediente. Tiene **dos bugs**:
   - No filtra por `organization_id` → si dos organizaciones usan el mismo BL Master (algo común con navieras globales), la segunda hereda el folio de la primera. Multi-tenant roto.
   - No filtra por `deleted_at IS NULL` → puede resucitar folios de embarques eliminados.
3. **Estado actual de la secuencia**: `embarque_consecutivo_seq.last_value = 316`, pero al reasignar los duplicados ya existen `ELIMP00317` y `ELIMP00318`. El próximo `nextval` devolvería 317 → colisiona contra el índice único que agregamos en 13.288.4 y **falla al crear el siguiente embarque**. Hay que sincronizar la secuencia ya.
4. **Los duplicados originales** (`ELIMP00150`, `ELIMP00304`) fueron creados el mismo minuto de abril 2026 por el mismo usuario — muy probablemente por un backfill/seed histórico que insertó filas sin pasar por la RPC. No es un bug reproducible del flujo actual, pero el índice único que ya agregamos lo bloquea permanentemente.

## Plan de cambios

### 1. Migración SQL (una sola)

**a. Sincronizar la secuencia** al máximo consecutivo real observado en la tabla, para no chocar con `ELIMP00317` / `ELIMP00318`:

```sql
SELECT setval(
  'embarque_consecutivo_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(expediente, '\D', '', 'g'), '')::bigint), 0)
       FROM public.embarques),
    nextval('embarque_consecutivo_seq') - 1
  ),
  true
);
```

**b. Arreglar `resolver_expediente_por_bl`** para que sea multi-tenant y respete soft-delete:

```sql
CREATE OR REPLACE FUNCTION public.resolver_expediente_por_bl(_bl_master text, _tipo_op text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := public.current_org_id();  -- o el helper equivalente
  v_exp text;
BEGIN
  SELECT expediente INTO v_exp
  FROM public.embarques
  WHERE bl_master = _bl_master
    AND organization_id = v_org
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_exp IS NOT NULL THEN
    RETURN v_exp;
  END IF;

  RETURN public.generar_expediente(_tipo_op);
END;
$$;
```

**c. (Defensa en profundidad)** Cambiar `generar_expediente(text)` para que, si por carrera de secuencia el folio armado colisiona con un `expediente` ya existente en la misma organización, itere hasta el siguiente `nextval` libre en vez de devolver un valor que luego rompe el insert:

```sql
LOOP
  consecutivo := nextval('embarque_consecutivo_seq');
  v_exp := 'EL' || prefijo || lpad(consecutivo::text, 5, '0');
  EXIT WHEN NOT EXISTS (
    SELECT 1 FROM public.embarques
    WHERE expediente = v_exp AND deleted_at IS NULL
  );
END LOOP;
RETURN v_exp;
```

### 2. Verificación

- `SELECT last_value FROM embarque_consecutivo_seq;` ≥ 318.
- Query de sanidad: sin duplicados en `(organization_id, expediente)` con `deleted_at IS NULL` (ya lo garantiza el índice único agregado en 13.288.4).
- Test SQL rápido: llamar dos veces `resolver_expediente_por_bl('BL-DEMO','Importación')` desde dos orgs distintas debe devolver **dos folios distintos**.

### 3. Documentación

- Nota en `CHANGELOG.md` bajo nueva versión `13.288.5` explicando los tres candados (secuencia sincronizada, RPC multi-tenant, generador auto-recuperable) y por qué existían.
- Actualizar `mem://technical/shipment-identification-logic` con la regla: "`resolver_expediente_por_bl` filtra por `organization_id` y `deleted_at IS NULL`; la secuencia global se auto-corrige ante colisiones".

## Fuera de alcance

- No se toca la UI ni los servicios de frontend — la firma de ambas RPCs se mantiene.
- No se auditan otras tablas con folio (proformas, facturas) en este cambio; si quieres, lo hago después en un plan aparte.

## Detalles técnicos

- Archivos a crear: 1 migración nueva en `supabase/migrations/` con los tres statements idempotentes (`CREATE OR REPLACE` + `setval`).
- Archivos a tocar: `CHANGELOG.md`, `src/constants/appVersion.ts`, memoria `mem://technical/shipment-identification-logic`.
- Riesgo: bajo. `setval` es idempotente y las funciones se reemplazan sin cambiar firma; los call-sites (`documentos.ts`, `crear_embarque_borrador_desde_cotizacion`) siguen funcionando igual.

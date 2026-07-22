# Fix: folio interno se salta al borrar la última factura de proveedor

## Diagnóstico (analogía)

Imagínate una libreta con folios pre-impresos y un contador en la contraportada. Cada vez que abres una hoja nueva, el contador sube. Hoy, si arrancas la hoja recién abierta, el contador **no baja** — así que la próxima hoja salta de número.

Verificado en DB:

- Trigger `trg_set_folio_interno_proveedor_factura` (BEFORE INSERT) llama a `siguiente_folio_proveedor`, que hace `ultimo_numero := ultimo_numero + 1` en `folio_secuencias`.
- Al borrar es *soft delete* (`deleted_at`), y no hay lógica que ajuste `folio_secuencias`.
- El unique index `proveedor_facturas_folio_interno_org_uq` **ya excluye** filas con `deleted_at IS NOT NULL` (`WHERE deleted_at IS NULL`), o sea que reusar el folio en un alta nueva no choca con la fila borrada.
- Estado actual observado: `FP-000045` y `FP-000044` están borrados, `FP-000046` está vivo, `ultimo_numero = 46`. Todo correcto por ahora, pero si borras `FP-000046` el siguiente sería `FP-000047`.

## Decisión del usuario

**Reusar el folio sólo si borraste la última.** Si borras una intermedia, el hueco se queda.

## Cambios

### Migración

Nueva función y trigger sobre `proveedor_facturas`:

```sql
CREATE OR REPLACE FUNCTION public.tg_liberar_folio_proveedor_factura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_num      bigint;
  v_max_vivo bigint;
BEGIN
  -- Sólo cuando pasa a borrado (soft delete)
  IF NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Parsea el número del folio FP-000046 -> 46
  v_num := NULLIF(regexp_replace(NEW.folio_interno, '\D', '', 'g'), '')::bigint;
  IF v_num IS NULL THEN
    RETURN NEW;
  END IF;

  -- Recalcula: MAX de folios activos (no borrados) para esta org
  SELECT COALESCE(MAX(NULLIF(regexp_replace(folio_interno, '\D', '', 'g'), '')::bigint), 0)
    INTO v_max_vivo
    FROM public.proveedor_facturas
   WHERE organization_id = NEW.organization_id
     AND deleted_at IS NULL;

  -- Sólo retrocede el contador si NO quedan folios activos con número mayor.
  -- Así garantizamos "reusar sólo si borraste la última" y también cubre el caso
  -- de borrar varias últimas en cadena (el contador queda pegado al MAX vivo).
  UPDATE public.folio_secuencias
     SET ultimo_numero = v_max_vivo,
         updated_at    = now()
   WHERE organization_id = NEW.organization_id
     AND tipo            = 'factura_proveedor'
     AND ultimo_numero   > v_max_vivo;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_liberar_folio_proveedor_factura
AFTER UPDATE OF deleted_at ON public.proveedor_facturas
FOR EACH ROW
WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
EXECUTE FUNCTION public.tg_liberar_folio_proveedor_factura();
```

Notas:

- Se dispara sólo cuando `deleted_at` pasa de `NULL` → algo (no en restore ni en updates normales).
- No decrementa a ciegas: recalcula contra `MAX(numero)` de filas vivas. Si borras `FP-000046` (última), baja el contador a 41 (o al que sea el MAX vivo). Si borras `FP-000042` (intermedia), no baja porque hay folios vivos mayores. Cumple exactamente "reusar sólo si borraste la última".
- Cubre borrado en cadena: si tumbas 46, 41, 40, 37 seguidos, el contador queda pegado al MAX vivo restante.
- Compatible con el unique index parcial existente — si reasigna un folio, no choca con la fila borrada.

### Sin cambios de frontend

Toda la lógica queda en BD. El servicio `crearFacturaProveedor` sigue llamando al mismo trigger `BEFORE INSERT` que resuelve `siguiente_folio_proveedor` con el contador ya corregido.

### Test unitario

- `src/lib/__tests__/folio-proveedor-liberacion.test.ts`: verifica por regex que la migración contiene `tg_liberar_folio_proveedor_factura` y que sólo actualiza cuando `ultimo_numero > v_max_vivo`. (Alineado con el patrón existente `garantias-fase-p3.test.ts`.)

### Versión / changelog

- `APP_VERSION` → `13.307.14`.
- Entrada en `CHANGELOG.md` explicando el bug (folio saltado al borrar), la decisión de producto (reusar sólo si es la última) y el nuevo trigger.

## Fuera de alcance

- No se cambia el comportamiento para huecos intermedios (el usuario los deja explícitamente).
- No se toca `siguiente_folio_proveedor` (sigue igual, ahora el contador que lee ya está corregido).
- No hay backfill retroactivo: los huecos históricos (por ejemplo si hoy `ultimo_numero=46` pero borras la 46, quedaría en 41) se corrigen en el momento del próximo borrado, no antes.

## Bug

El guard `trg_pago_factura_rep_viva` (Fase F v13.301.75) se dispara en **cualquier INSERT** en `pagos_factura` — no sólo cuando se está timbrando un REP. La función tiene un early-exit que devuelve temprano si no hay REP en curso, pero la lista de estados "no-REP" que reconoce es incompleta:

```
IF NEW.uuid_rep IS NULL AND NEW.facturapi_rep_id IS NULL
   AND (NEW.estado_rep IS NULL OR NEW.estado_rep IN ('','pendiente','cancelado'))
THEN RETURN NEW;
```

Pero `pagos_factura.estado_rep` tiene default `'NoAplica'` (NOT NULL). Ese valor no matchea el early-exit, así que la función procede a validar que la factura tenga `uuid_fiscal`. Cualquier pago sobre una factura no timbrada (borrador, o fixture de RLS) rompe con `LC_REP_FACTURA_SIN_TIMBRAR`.

Esto se disparó en el fixture `supabase/tests/rls/test_rls_financiero_critico.sql` línea 327, pero el mismo bug afectaría a la app en producción cada vez que se registra un pago manual antes de timbrar el REP.

## Fix (migración hotfix v13.301.76)

Un solo `CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_rep()` que ajusta el early-exit para que la función sólo valide cuando **realmente hay un REP en curso**:

```sql
-- Sólo validamos cuando la fila timbra un REP.
IF NEW.uuid_rep IS NULL AND NEW.facturapi_rep_id IS NULL THEN
  RETURN NEW;
END IF;
```

`estado_rep` deja de participar en el gate — un pago sin `uuid_rep` ni `facturapi_rep_id` **no está timbrando REP** por definición, independientemente de lo que diga `estado_rep`. El resto de la función (que exige `uuid_fiscal IS NOT NULL` y estado vivo) queda igual.

También aprovecho para reforzar el trigger con una `WHEN` clause que corta antes de invocar la función, evitando work innecesario:

```sql
CREATE TRIGGER trg_pago_factura_rep_viva
  BEFORE INSERT OR UPDATE OF uuid_rep, estado_rep, facturapi_rep_id
  ON public.pagos_factura
  FOR EACH ROW
  WHEN (NEW.uuid_rep IS NOT NULL OR NEW.facturapi_rep_id IS NOT NULL)
  EXECUTE FUNCTION public.assert_factura_viva_para_rep();
```

## Guardrail

Extender `src/lib/__tests__/candados-pagos-rep-nc-fase-f.test.ts`:

- Assert que **la última** definición de `assert_factura_viva_para_rep` **no** referencia `estado_rep` en el early-exit (regresión contra el bug actual).
- Assert que **la última** definición del trigger incluye la `WHEN` clause con `uuid_rep IS NOT NULL OR facturapi_rep_id IS NOT NULL`.

El loader ya recorre las migraciones ordenadas desc y toma la primera que matchea el marcador de Fase F, así que después del hotfix leerá el archivo nuevo automáticamente.

## Verificación

- `bun run test` (subconjunto de Fase F + fixtures de RLS afectados).
- `bun run ci:local` completo — el fixture `test_rls_financiero_critico.sql` que falló debe pasar ahora sin tocarlo.

## Changelog + versión

- `CHANGELOG.md`: entrada `[13.301.76]` con explicación del hotfix.
- `src/constants/appVersion.ts` → `"13.301.76"`.

## Ficheros tocados

| Archivo | Acción |
|---|---|
| `supabase/migrations/<timestamp>_fase_f_hotfix_rep_early_exit.sql` | nuevo (redefine función + recrea trigger con WHEN) |
| `src/lib/__tests__/candados-pagos-rep-nc-fase-f.test.ts` | +2 asserts |
| `src/constants/appVersion.ts` | bump |
| `CHANGELOG.md` | entrada 13.301.76 |

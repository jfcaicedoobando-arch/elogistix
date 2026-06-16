## Diagnóstico CI – Suite RLS (7 jobs en rojo)

Análisis del zip `logs_74453342868.zip`. Cada job RLS aborta en el primer `DO $$ … $$` por uno de estos cinco síntomas:

| # | Suite | Causa raíz | Tipo |
|---|---|---|---|
| 1 | `isolation` | `ERROR: permission denied for table clientes` | **Bug app**: falta `GRANT … ON public.clientes TO authenticated` |
| 2 | `operaciones` | `permission denied for table proveedores` | **Bug app**: falta GRANT en `public.proveedores` |
| 3 | `financiero_critico` | `permission denied for table cuentas_bancarias` | **Bug app**: revisar si un REVOKE posterior eliminó el grant (la migración original sí lo tiene) |
| 4 | `tarifas_y_costeo` | FK `costeo_rutas_puerto_origen_id_fkey` | **Bug test**: falta seed de puerto en el bloque DO |
| 5 | `crm_operacional` | CHECK `crm_leads_score_check` (rango 1‑5) | **Bug test**: score fuera de rango |
| 6 | `roles_no_admin` | enum `estado_factura` no acepta `'Pendiente'` | **Bug test**: valor inexistente (válidos: Borrador / Emitida / Pagada / Vencida / Cancelada / Parcialmente pagada) |
| 7 | `financiero` | Mismo enum `estado_factura: 'Pendiente'` | **Bug test** |

---

## Plan de remediación

### 1. Nueva migración `…_rls_grants_missing.sql`
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;`
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;`
- `GRANT ALL ON public.clientes, public.proveedores TO service_role;`
- Re-aplicar `GRANT … ON public.cuentas_bancarias` por idempotencia (cubre el caso 3 sin necesidad de auditar línea por línea quién revocó).
- Recorrer `supabase/tests/rls/_ci_verify_rls.sql` y, si existe el chequeo, extenderlo para fallar cuando una tabla pública con RLS no tenga grants a `authenticated`.

### 2. Fix de los tests SQL (sólo datos de seed)
- `test_rls_crm_operacional.sql`: cambiar `score = 10` (o el valor inválido) por un entero en `[1,5]`.
- `test_rls_roles_no_admin.sql` y `test_rls_financiero.sql`: reemplazar `'Pendiente'` → `'Emitida'` en todos los INSERT/UPDATE/SELECT sobre `facturas.estado`.
- `test_rls_tarifas_y_costeo.sql`: antes del INSERT de `costeo_rutas` insertar un puerto de prueba (`INSERT INTO public.puertos(...) RETURNING id INTO puerto_x`) o usar un puerto existente del seed; pasar ese `id` a `puerto_origen_id` y `puerto_destino_id`.

### 3. Validación local previa al push
- Reproducir cada suite con el snapshot:
  ```text
  psql … -f supabase/tests/rls/_helpers.sql -f supabase/tests/rls/test_rls_isolation.sql
  ```
- Confirmar que todas las suites imprimen su `RAISE NOTICE '✓ … aserciones OK'`.

### 4. Changelog
- Bump `APP_VERSION` (parche) en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` (root) con la fecha de hoy listando los 5 fixes (3 grants + 4 seeds de test).

### Detalles técnicos (referencia)
- Los grants faltantes son **regresión real**: PostgREST/Data API no expone tablas sin grant explícito; aunque las políticas RLS estuvieran bien, cualquier cliente con rol `authenticated` recibe `permission denied`.
- El ID exacto de línea reportado por psql (`:187`, `:276`, …) corresponde al cierre `$$;` del bloque DO; el `SELECT count(*) FROM public.clientes` que dispara el error está antes (línea 69 / 77 / 87 según suite).
- Mantengo el RPC `has_role` y demás policies intactas — el fix es estrictamente perimetral (grants) + corrección de fixtures.

### Fuera de alcance
- Subir umbral de cobertura.
- Reordenar suites o paralelización del workflow.

## Diagnóstico (verificado en BD)

El usuario ve "COT-2026-0123" (y sus duplicados `-DUP-2`, `-DUP-3`) en el buscador global, pero al abrir el detalle el registro no aparece. Consultando `cotizaciones` en BD:

| folio | estado | deleted_at |
|---|---|---|
| COT-2026-0123 | Borrador | 2026-07-13 19:43 |
| COT-2026-0123-DUP-2 | Borrador | 2026-07-14 01:37 |
| COT-2026-0123-DUP-3 | Borrador | 2026-07-20 22:31 |

Las tres están **soft-deleted** (`deleted_at` con fecha). El detalle sí respeta `deleted_at IS NULL`, pero al inspeccionar `busqueda_global` en Postgres, la CTE de cotizaciones **no** filtra por `c.deleted_at IS NULL` — sólo filtra por organización:

```sql
FROM cotizaciones c
WHERE (c.folio ILIKE ... OR c.cliente_nombre ILIKE ... OR c.prospecto_empresa ILIKE ...)
  AND (c.organization_id = current_user_org_id() OR has_role(auth.uid(),'super_admin'))
```

Por eso los resultados del buscador incluyen "fantasmas" ya borrados.

**Analogía:** el buscador es un índice del archivero, pero seguimos listando carpetas que ya movimos a la trituradora. Al ir a leerlas, no están.

## Cambios propuestos

1. **Migración `patch_busqueda_global_deleted_at`**
   - Recrear `public.busqueda_global` añadiendo `AND c.deleted_at IS NULL` al bloque cotizaciones.
   - Auditar en la misma función los demás bloques `UNION ALL` (embarques, proformas, facturas, clientes, proveedores…) y añadir `X.deleted_at IS NULL` en cualquiera cuya tabla tenga esa columna y aún no lo filtre. Mantener firma, `SECURITY DEFINER`, `search_path` y grants existentes; sin cambios de permisos.

2. **Test de regresión**
   - `supabase/tests/rls/test_busqueda_global_deleted_at.sql`: sembrar una cotización soft-deleted y otra viva con el mismo folio parcial, invocar `busqueda_global('COT-...')` y afirmar que sólo aparece la viva. Ejecutado por `ci-fast.sh --only rls`.

3. **Documentación**
   - `CHANGELOG.md` entrada nueva en la parte superior con la analogía.
   - `APP_VERSION` → `13.320.23`.

## Fuera de alcance

- No se tocan RLS ni grants (el problema es de filtro dentro del RPC, no de permisos).
- No se restaurarán ni borrarán los tres registros de "COT-2026-0123" — quedan como estaban (soft-deleted). Si el usuario quiere recuperar alguno, es una acción separada.

## Detalles técnicos

- Archivo: nueva migración en `supabase/migrations/<timestamp>_patch_busqueda_global_deleted_at.sql` usando `CREATE OR REPLACE FUNCTION`.
- Antes de escribir la migración, se leerá la definición completa del RPC (`pg_get_functiondef`) para preservar exactamente el resto de UNION ALL, LIMITs y firma.
- Se validará con `audit:migrations` (H4/H6) para conservar `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated, service_role` si ya existen.

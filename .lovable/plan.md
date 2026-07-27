
## Diagnóstico

CI verde salvo `Architecture & audits > audit:migrations` (7 violaciones en 3 migraciones). Los demás jobs (Tests, Build, ESLint, TS, Edge Functions, etc.) están en verde — los `[bitacora] excepción` y stderrs son ruido esperado de tests negativos.

### H4 · 3 violaciones (Sidebar 3.0 — `nav_events`)
Archivo: `supabase/migrations/20260725203639_038203bc-c2cc-4798-8cfa-9c188f044cae.sql`
- `CREATE INDEX idx_nav_events_org_fecha` sin `IF NOT EXISTS`.
- `CREATE POLICY "nav_events insert own org"` sin `DROP POLICY IF EXISTS` previo.
- `CREATE POLICY "nav_events read admin"` sin `DROP POLICY IF EXISTS` previo.

### H6 · 4 violaciones (SECURITY DEFINER sin blindaje)
`crear_embarque_borrador_core(uuid)` fue redefinida hoy en dos migraciones sin `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated, service_role`:
- `supabase/migrations/20260727164113_6a368d79-098d-497e-99fa-f83fe5ccac04.sql`
- `supabase/migrations/20260727170323_462128aa-36de-45cd-b201-839dab5d9583.sql`

Analogía: son 3 puertas que quedaron sin cerradura reglamentaria. La casa funciona, pero el inspector (audit) las marca hasta que atornillamos la manija correcta.

## Cambios

1. **Patch H4** en la migración de `nav_events`:
   - `CREATE INDEX` → `CREATE INDEX IF NOT EXISTS`.
   - Anteponer `DROP POLICY IF EXISTS ... ON public.nav_events;` a cada una de las dos policies afectadas.

2. **Patch H6** en las dos migraciones de `crear_embarque_borrador_core`: al final de cada archivo, tras el `CREATE OR REPLACE FUNCTION`, agregar:
   ```sql
   REVOKE ALL ON FUNCTION public.crear_embarque_borrador_core(uuid) FROM PUBLIC;
   GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_core(uuid) TO authenticated, service_role;
   ```

3. **Verificación**: ejecutar `bun run audit:migrations` local — debe pasar con 0 violaciones.

4. **Metadata**:
   - `APP_VERSION` → `13.320.3`.
   - Entrada `CHANGELOG.md`: "fix · CI audit:migrations (H4 + H6) reparados sin cambio funcional."

## Nota técnica

Las migraciones ya se aplicaron en la DB; estos parches son idempotentes y solo satisfacen el auditor estático (que lee archivos, no la DB). No requieren re-migración porque los objetos ya existen. `IF NOT EXISTS` y `DROP POLICY IF EXISTS` mantienen la operación segura ante replays o restauraciones.

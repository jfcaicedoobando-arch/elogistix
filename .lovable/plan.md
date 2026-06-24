# Auditoría RLS Tests & GitHub Actions

## Resultado general

**RLS tests**: en buen estado general (BEGIN/ROLLBACK, UUIDs random, helper `as_user`, verificador de cobertura `_ci_verify_rls.sql`, validación de matrix↔archivos). Pero hay **6 findings HIGH** que dejan agujeros silenciosos de cobertura.

**GitHub Actions**: muy bien estructurados (SHA-pinned, permissions mínimas, concurrency, timeouts, Postgres pinned por digest). **1 finding CRITICAL** de supply-chain en `actionlint.yml` y varios MEDIUM cosméticos.

Reporte completo con file:line y severidad ya entregado arriba. Esta planificación se enfoca SOLO en lo que pediste arreglar: **CRITICAL + HIGH**.

---

## Cambios a implementar (CRITICAL + HIGH únicamente)

### 🔴 CRITICAL

**1. `.github/workflows/actionlint.yml:40` — Pinear versión de actionlint**
Añadir `1.7.7` al final del comando para evitar ejecutar un script de `main` sin verificar integridad (supply-chain).

### 🟠 HIGH — RLS tests

**2. `supabase/tests/rls/_ci_drift.sql` — Stub de tablas opcionales**
Crear stubs mínimos (con RLS + policies tenant-isolated) para `gastos_embarque`, `cuentas_por_cobrar`, `comisiones_devengadas`, `liquidaciones_comision` **solo si no existen**. Esto desbloquea eliminar los `IF EXISTS` guards.

**3. `supabase/tests/rls/test_rls_financiero.sql:109-131` — Eliminar guards IF EXISTS**
Quitar los bloques `IF EXISTS (information_schema.tables…)` alrededor de los tests de `cuentas_por_cobrar` y `gastos_embarque`. Ahora siempre corren.

**4. `supabase/tests/rls/test_rls_financiero_critico.sql:215-247 + 253-283` — Eliminar guards y añadir WITH CHECK faltantes**
- Quitar guards de `comisiones_devengadas` y `liquidaciones_comision`.
- Añadir `assert_insert_blocked` cruzado para `bbva_movimientos`, `pagos_factura`, `pagos_proveedor`, `factura_notas_credito` (actualmente solo cubren `cuentas_bancarias`, `proveedor_facturas`, `cotizacion_costos`).

**5. `supabase/tests/rls/test_rls_isolation.sql` — Añadir SELECT isolation para `bitacora_actividad`**
Insertar como `postgres` un log de `org_b`, cambiar a `user_a` y aserción `COUNT(*) = 0`. Hoy solo se prueba bloqueo de INSERT cruzado.

**6. `supabase/tests/rls/test_rls_roles_no_admin.sql` — Test de escalada de privilegios**
Añadir dos casos negativos:
- `operador` intentando `INSERT INTO user_roles … 'super_admin'` debe fallar.
- `viewer` intentando ejecutar una función de admin (ej. `seed_presupuesto_categorias(org_b)`) debe fallar.

### Out of scope (no se tocan en esta tanda)

- Drift documentado en `_ci_drift.sql` (`proformas.es_consolidada`, `tracking_intentos`, `tracking_externo` creados manualmente en prod sin migración) → necesita validación de schema real de prod, lo abordamos en plan separado.
- Findings MEDIUM/LOW: `RESET ROLE` → helper, `ubuntu-latest` → `ubuntu-24.04`, `deno-version: "1.46"`, e2e en PR, anon key a secret, etc.

---

## Detalles técnicos

### actionlint.yml
```diff
- bash <(curl -sSfL https://…/download-actionlint.bash)
+ bash <(curl -sSfL https://…/download-actionlint.bash) 1.7.7
```

### Stubs en `_ci_drift.sql`
Cada stub sigue el patrón:
```sql
CREATE TABLE IF NOT EXISTS public.<tabla> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  monto numeric(14,2)  -- mínimo necesario para los tests
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabla> TO authenticated;
GRANT ALL ON public.<tabla> TO service_role;
ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <tabla>_tenant_isolation ON public.<tabla>
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
```
Marcado con prefijo `_ci_` en nombre de policy para que sean removibles si la tabla real llega vía migración.

### Nuevos assertions
- `bitacora_actividad`: `assert(visible_count_org_b = 0)` después de insertar como `postgres` y cambiar a `user_a`.
- `bbva_movimientos`, `pagos_factura`, `pagos_proveedor`, `factura_notas_credito`: `pg_temp.assert_insert_blocked('INSERT INTO public.<tabla>(organization_id,…) VALUES (org_b,…)', '<tabla> WITH CHECK')`.
- `user_roles` escalada: `assert_insert_blocked` con role='super_admin' como `operador`.
- Función de admin: `BEGIN PERFORM public.seed_presupuesto_categorias(org_b); RAISE EXCEPTION 'should have failed'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL; END;`.

### Archivos auxiliares
- `CHANGELOG.md`: nueva entrada `13.135.6 - Hardening de CI y cobertura RLS`.
- `src/constants/appVersion.ts`: bump a `13.135.6`.

---

## Riesgos

- **Stubs de tablas**: si en prod una de esas 4 tablas existe con schema distinto, no afecta CI (solo se crean si no existen) ni prod (las migraciones reales tienen prioridad). En el peor caso un test fallaría en CI por columnas faltantes — fix iterativo.
- **Escalada de privilegios**: si la función `seed_presupuesto_categorias` resulta no estar restringida por rol, el test fallará y revelará un bug real — el objetivo es exactamente ese.
- **`actionlint 1.7.7`**: versión estable actual, sin breaking changes esperados.

¿Lo apruebo y procedo a implementar?

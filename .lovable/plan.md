## Recomendación: sí, pero selectivamente

Los CRITICAL/HIGH ya cerraron los gaps de seguridad reales (supply-chain del runner + falsos verdes en RLS). Lo que queda es **higiene de CI** — vale la pena, pero no urge. Te propongo dividir en dos tandas según ROI.

---

### Tanda A — Quick wins (alto valor, bajo riesgo) ✅ recomendado

1. **Pin de runners a versión exacta** — Cambiar `runs-on: ubuntu-latest` → `ubuntu-24.04` en los 8 workflows. Evita que un bump silencioso de GitHub rompa CI sin aviso.

2. **Pin de imagen Docker en `rls-tests.yml`** — `postgres:15` → `postgres:15.8` (o el digest SHA256). Mismo motivo: reproducibilidad.

3. **Pin de Deno en `ci.yml`** — `denoland/setup-deno@v2` con `deno-version: v1.46.x` explícito en vez de flotante.

4. **`RESET ROLE` → `pg_temp.as_postgres()`** — Auditar las 6 suites RLS y reemplazar cualquier `RESET ROLE` pelado que haya quedado. El helper ya existe (`_helpers.sql`); evita falsos verdes cuando el `request.jwt.claims` viejo persiste.

5. **`concurrency` faltante** — Revisar que los 8 workflows tengan bloque `concurrency` con `cancel-in-progress` (algunos legacy puede que no lo tengan). Ahorra minutos de runner en pushes consecutivos.

**Estimado:** ~15-20 líneas tocadas, 0 lógica nueva, bajo riesgo de romper nada.

---

### Tanda B — Mejoras de cobertura (valor medio, requieren decisión)

6. **Stubs en `_ci_drift.sql`** para `gastos_embarque`, `cuentas_por_cobrar`, `comisiones_devengadas`, `liquidaciones_comision` — para que las suites RLS no dependan de `IF EXISTS`. **Requiere validar primero** si esas tablas existen en prod o son drift legítimo (la auditoría las marcó como "manual sin migración"). Si son drift real, primero hay que crear la migración formal; si no, los stubs CI son seguros.

7. **Test de escalación `viewer → seed_presupuesto_categorias(org_b)`** en `test_rls_roles_no_admin.sql` — Cubre un vector que hoy no se prueba.

8. **`anon key` a secret en `post-deploy-smoke.yml`** — La anon key ya es pública por diseño en Supabase, pero moverla a secret es buena higiene.

9. **E2E en PR (no solo weekly)** — Solo si quieres detectar regresiones funcionales antes del merge. Cuesta minutos de runner.

---

### Mi recomendación

**Hacer Tanda A ahora** (15 min, blinda CI contra cambios externos silenciosos) y **dejar Tanda B para cuando aparezca el síntoma** (ej. cuando alguien cree de verdad la tabla `comisiones_devengadas`, ahí activas los tests).

### ¿Qué hago?

- **A**: Implementar solo Tanda A (5 quick wins).
- **B**: Implementar Tanda A + Tanda B completa.
- **C**: Solo punto específico (dime cuál).
- **D**: Dejarlo aquí — el baseline CRITICAL/HIGH ya está sano.

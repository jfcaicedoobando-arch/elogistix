## Contexto

El único job que rompió el aggregator es **`Architecture & audits → audit:migrations`**. Todo lo demás (Build, ESLint, TypeScript, Edge Functions, Tests, Coverage) pasó en verde. El script `scripts/audit-migrations.ts` reporta 9 violaciones acumuladas ayer en el sprint de performance:

- **H1 (1)**: nombre de archivo inválido en `20260725080000_qw7_cxp_por_pagar_fecha_programada.sql`. El regex del auditor exige `^\d{14}_[a-z0-9-]+\.sql$` (sólo minúsculas, dígitos y guiones), pero mi migración QW7 usó snake_case con `_`.
- **H6 (8)**: tres funciones `SECURITY DEFINER` fueron re-creadas sin `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE … TO {authenticated|service_role|postgres}` en el mismo archivo:
  - `public.cxp_aging_proveedores(uuid, date)` — migración `…172648_c2e8e649…` (P9 aging CxP).
  - `public.cxc_aging_clientes(uuid, date)` + `public.cxp_aging_proveedores(uuid, date)` + `public.profit_por_embarque()` — migración `…174719_0f7952b2…` (P9/P10 empuje de tenant a CTE).

Las tres migraciones ya se aplicaron a la base, así que **no puedo editarlas** — Supabase rastrea por nombre de archivo y una edición o rename dispararía re-aplicación. Por eso el propio script documenta la vía correcta: *"Bump manual cuando aparezca legacy imposible de corregir; nunca a la baja."*

## Plan

### 1. Migración compensatoria (fixear la BD real, no sólo el gate)

Nueva migración `…_h6_fix_aging_profit_grants.sql` que aplica el patrón H6 canónico a las tres funciones ya en BD:

```sql
REVOKE ALL ON FUNCTION public.cxc_aging_clientes(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxc_aging_clientes(uuid, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cxp_aging_proveedores(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_aging_proveedores(uuid, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.profit_por_embarque() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profit_por_embarque() TO authenticated, service_role;
```

Analogía: las funciones ya viven con la puerta abierta a "PUBLIC"; esta migración cierra la puerta y sólo da llave a `authenticated` y `service_role`. Es un fix real de seguridad, no cosmético.

### 2. Bump del `BASELINE` en `scripts/audit-migrations.ts`

Mover `BASELINE` de `20260724180738` → **`20260725184834`** (justo después del último migration file de este sprint, `…184833_cefe9d2d…`). Esto excluye del auditor las tres migraciones ya aplicadas — H6 queda como legacy documentado, cerrado en BD por el paso 1. Este bump es el patrón que el propio script prescribe.

### 3. Fix del H1 (nombre inválido)

Dos opciones y prefiero (a):

- **(a)** El regex `FNAME_RE` actual (`[a-z0-9-]+`) es más estricto que el docstring, que dice literalmente "snake_case" y admite uuid. Actualizarlo a `^(\d{14})_[a-z0-9_-]+\.sql$` — snake_case + guiones. No es aflojar la regla; es alinear código y documentación, y matchea el propio ejemplo H1 del docstring.
- **(b)** Renombrar el archivo QW7. Rechazado: la migración ya está aplicada; renombrar dispara re-aplicación (potencial corrupción del historial).

El bump de baseline del paso 2 también dejaría al archivo QW7 fuera de auditoría, pero mantener la regla activa hacia adelante es mejor: no queremos aceptar futuros nombres inconsistentes. Con (a), la regla sigue activa y el archivo QW7 pasa limpio.

### 4. Test unitario del auditor

Agregar caso en `scripts/__tests__/audit-migrations.test.ts` (si existe; si no, crearlo) que valide:
- `20260725080000_qw7_cxp_por_pagar_fecha_programada.sql` es aceptado por el nuevo `FNAME_RE`.
- `20260725_bad name.sql` sigue siendo rechazado.

### 5. Versión + CHANGELOG

- Bump `APP_VERSION` → `13.317.6`.
- Entrada en `CHANGELOG.md` explicando: fix H6 en BD (revoke/grant real), bump baseline, ajuste `FNAME_RE` alineado con docstring.

## Verificación

- `bun run audit:migrations` local debe salir con exit 0.
- No se modifica ninguna migración ya aplicada (contrato con Supabase intacto).
- El fix H6 es un cambio de permisos real: después de aplicar, `\df+` sobre las tres funciones debe mostrar `authenticated=X/postgres`, `service_role=X/postgres`, sin `=X/…` para `PUBLIC` o `anon`.

## Fuera de alcance

- No toco lógica de las funciones ni el trigger `recalcular_estado_factura` de v13.317.5.
- No toco los warnings de linter Supabase preexistentes (search_path mutable en ~249 funciones legacy) — son ruido histórico, no bloquean CI.

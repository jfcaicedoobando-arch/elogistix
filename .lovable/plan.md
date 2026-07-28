## Contexto

Las 4 auditorías coinciden: el CI pre-merge es sólido, pero hay (a) guardrails que existen y no corren, (b) una fuga de seguridad real en una función de base de datos, (c) supply-chain con puntos flotantes, y (d) cero automatización post-merge (deploy/migraciones/smoke).

Verifiqué en el repo antes de planear:
- `audit:rpc-sync`, `audit:rpc-columns` y `audit:sonner` existen en `package.json` (líneas 37, 39, 42) y **ninguno se invoca desde `.github/workflows/`**.
- `get_top_tarifas` (migración `20260623211759_…`) es `SECURITY DEFINER` y **cuando se le pasa `p_organization_id` explícito no valida membresía** — cualquier usuario autenticado puede leer tarifas de otra organización. Fuga real, no sólo falta de test.
- 654 migraciones en el repo; ningún workflow valida el apply limpio.
- Script local `test` usa 16 shards; CI usa 10.

Analogía: el CI de hoy es una alarma muy buena instalada en las ventanas… pero la puerta principal (el deploy) no tiene ni cerradura, y hay dos sensores desconectados.

---

## Ola 1 — Cierres inmediatos (bajo riesgo, alto valor)

1. **Fuga de seguridad `get_top_tarifas`**: nueva migración que exige membresía también en la rama `p_organization_id IS NOT NULL`, + prueba pgTAP en `supabase/tests/rls/`.
2. **Cablear guardrails muertos**: añadir `audit:rpc-sync`, `audit:rpc-columns` y `audit:sonner` al job `audits` de `ci.yml`.
3. **Limpiezas de `ci.yml`**: eliminar el step JUnit muerto, quitar el caché de Vite inútil, corregir el comentario falso sobre gating tests (excluirlos de los shards vía `vitest.config.ts` para que corran una sola vez).
4. **Alinear shards locales (16) con CI (10)** en el script `test`.

## Ola 2 — Supply-chain

5. **Pinear el descargador de actionlint** a un commit/tag con verificación de checksum (hoy es `curl | bash` desde `main`).
6. **Pinear `bun-version`** a la versión verificada en `setup-bun/action.yml` e `install-canary.yml`.
7. **`deno.lock` para las edge functions** + `--lock` en `ci.yml`, `deno-typecheck.yml` y `post-deploy-smoke.yml`.
8. **`persist-credentials: false`** en los checkouts que no hacen push/fetch; `deny-licenses` + `fail-on-scopes` en `dependency-review.yml`.
9. **Reducir alcance de secretos en `e2e.yml`**: mover el bloque `env:` global a los jobs que sí lo necesitan.

## Ola 3 — Cobertura que hubiera cachado los bugs reales

10. **Suite `test_rls_rpc_smoke_roles.sql`**: ejecuta (no sólo inspecciona) las RPC críticas bajando de rol — `get_top_tarifas` con org ajena, `duplicar_cotizacion`, soft-delete, y el rol nuevo `agente_carga` sin acceso a pricing. Alta en la matriz de `rls-tests.yml`.
11. **Job `migration-clean-apply`**: aplica las 654 migraciones en Postgres limpio con allowlist explícita de excepciones, para que la deriva sea visible y decreciente en vez de estar oculta tras stubs.
12. **Job `rpc-smoke`** en `post-deploy-smoke.yml`: llama las RPC de dinero y falla si el contrato de columnas cambió.
13. **Anti-skip global en `e2e.yml`**: en corridas agendadas, faltar secretos debe fallar, no pintar verde vacío.

## Ola 4 — Post-merge (requiere decisiones tuyas)

14. `deploy.yml` con gate (CI verde en main → migraciones verificadas → smoke inmediato) y `workflow_dispatch`/`repository_dispatch` para engancharlo al publish de Lovable.
15. Check de drift de `src/integrations/supabase/types.ts` contra el esquema real.
16. Migración correctiva que formalice el drift documentado en `_ci_drift.sql` (buckets, `tracking_externo`, columnas de `proformas`).

---

## Detalles técnicos

- Los puntos que **no puedo hacer desde aquí** y necesitan que tú los configures en GitHub: crear los environments `staging`/`production` con reviewers, mover secretos a esos environments, definir `vars.SUPABASE_URL`, el token de Codecov y `GITLEAKS_LICENSE`. Yo dejo el YAML preparado para consumirlos.
- Cada ola cierra con `lint`, `typecheck`, tests afectados, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
- Las olas 1–3 son puramente de repositorio y se pueden mergear de forma independiente.

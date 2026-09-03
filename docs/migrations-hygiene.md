# Higiene de migraciones SQL

Reglas obligatorias para toda migración creada a partir del baseline
`20260723223436` (2026-07-23). El auditor `bun run audit:migrations` las hace
cumplir en CI. Legacy anterior al baseline queda documentado pero no
bloquea el pipeline (imposible de reescribir sin refactor de esquema).

## Reglas

| ID | Regla | Motivo |
|----|-------|--------|
| **H1** | Nombre `YYYYMMDDHHMMSS_slug.sql` (slug snake-case/uuid). | Orden lexicográfico = orden temporal; imprescindible para `supabase db push`. |
| **H2** | Todo `CREATE TABLE public.X` debe llevar `GRANT ... ON public.X` en el **mismo archivo**. | PostgREST no otorga privilegios por defecto; sin GRANT la Data API devuelve `permission denied` en runtime. |
| **H3** | `DROP FUNCTION\|TABLE\|VIEW ... CASCADE` debe ir seguido de `CREATE OR REPLACE` o `CREATE TABLE` para la misma entidad. | Evita "olvidos" de recrear dependencias tras un CASCADE. |
| **H4** | `CREATE INDEX` requiere `IF NOT EXISTS`. `CREATE POLICY` requiere `DROP POLICY IF EXISTS ... ; CREATE POLICY ...` (Postgres <16 no soporta `CREATE POLICY IF NOT EXISTS`). | Migraciones idempotentes; permite re-ejecutar sin corromper estado. |
| **H5** | Prohibido `DROP TABLE public.X` sin `IF EXISTS`. | Idem H4; evita romper entornos donde la tabla ya se dropeó. |
| **H6** | Toda función `SECURITY DEFINER` en `public` debe llevar, en el mismo archivo: `REVOKE ALL ON FUNCTION ... FROM PUBLIC` **y** `GRANT EXECUTE ... TO {authenticated\|service_role\|postgres}`. Prohibido `GRANT EXECUTE ... TO PUBLIC` (regla dura, aplica también a legacy). Excepción explícita: comentario `-- audit:allow-no-grants` en la línea previa al `CREATE FUNCTION` para helpers privados intencionales. | `SECURITY DEFINER` corre con los privilegios del owner (habitualmente superuser) — sin `REVOKE FROM PUBLIC` cualquier rol conectado puede escalar. `GRANT EXECUTE TO PUBLIC` es escalación de privilegios directa. |

## Excepciones

- **RLS en tablas nuevas**: además del GRANT (H2), es obligatorio `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` en el mismo archivo. El auditor no valida esto (los tests de RLS lo hacen), pero es parte del contrato.
- **Enums nuevos**: no requieren GRANT, sólo `ALTER TYPE ... ADD VALUE IF NOT EXISTS` para bumps posteriores.

## Cómo correr localmente

```bash
bun run audit:migrations
```

Salida esperada en verde:

```text
✅ Migraciones limpias (post-baseline).
```

## Cuándo mover el baseline

Nunca a la baja. Si una migración legacy imposible de corregir aparece post-baseline (p. ej. renombre de archivo manual o una migración ya ejecutada/aplicada que no se puede editar), documentar el caso y **subir** el baseline al siguiente timestamp. Cambiar `BASELINE` en `scripts/audit-migrations.ts` + registrar la razón en el CHANGELOG.

### Histórico de baseline bumps

- `20260723213500` → `20260723223436` (2026-07-23): FIX-H6-01. Las migraciones
  `20260723220718_ee593a16…` y `20260723222256_a8da9a2c…` crearon funciones
  `SECURITY DEFINER` sin `REVOKE ALL … FROM PUBLIC` + `GRANT EXECUTE …`. Al no
  poder editar archivos de migración ya creados, se corrige en BD con una
  migración posterior (`20260723223436`) que re-aplica las funciones con los
  grants correctos; las migraciones originales quedan como legacy auditado.
- `20260723223436` → `20260724180738` (2026-07-24): FIX-H6-02. La migración
  `20260724180737_d76d8b84…` recreó `public.ensure_demo_membership(uuid)` como
  `SECURITY DEFINER` sin `REVOKE`/`GRANT EXECUTE` (fix del issue Sentry
  `JAVASCRIPT-REACT-1G` sobre rol legacy en tenant demo). Migración correctiva
  posterior (v13.312.12) re-aplica la función con `REVOKE ALL … FROM PUBLIC,
  anon` + `GRANT EXECUTE … TO service_role`; el archivo original queda como
  legacy auditado y el baseline sube un segundo después de su timestamp.

- `20260729170000` → `20260730051450` (2026-07-30): FIX-H6-03. La migración
  `20260730012022_ee702830…` (Q-04, SoD en cotizaciones) creó
  `public._cotizaciones_bloquear_auto_aceptacion()` como `SECURITY DEFINER` sin
  `REVOKE ALL … FROM PUBLIC` ni `GRANT EXECUTE …`. La migración correctiva
  `20260730051450` re-aplica la función con los grants correctos (y agrega la
  columna `cotizaciones.created_by` que el trigger requería); el archivo
  original queda como legacy auditado.

- `20260730051450` → `20260730163239` (2026-07-30): FIX-H6-04. La migración
  `20260730160942_eb3cc400…` (R-08, bloqueo de envío de cotizaciones sin
  importes) creó `public._cotizaciones_bloquear_envio_sin_importes()` como
  `SECURITY DEFINER` con `REVOKE ALL … FROM PUBLIC` pero sin
  `GRANT EXECUTE …`. La migración correctiva `20260730163239` re-aplica la
  función con `REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO
  authenticated, service_role`; el archivo original queda como legacy auditado.

- `20260731220419` (2026-07-31): FIX-H6-05. La migración
  `20260731220418_2daf3796…` (estado `Por liquidar`) recreó
  `embarque_operativo_completo`, `promover_embarque_por_liquidar`,
  `_trg_promover_por_liquidar`, `_trg_autocierre_por_liquidar`,
  `avanzar_estado_embarque`, `cerrar_embarque` y `reabrir_embarque` como
  `SECURITY DEFINER` sin `REVOKE ALL … FROM PUBLIC` / `GRANT EXECUTE …`. La
  migración correctiva `20260731224126` re-aplica los permisos; el archivo
  original queda como legacy auditado.

- `20260907000000` → `20260911000201` (2026-09-03): FIX-H6-06. La migración
  `20260911000200_replay_recompute_totales_embarque.sql` re-emitió
  `public._recompute_totales_embarque(uuid)` como `SECURITY DEFINER` sin
  `REVOKE ALL … FROM PUBLIC` ni `GRANT EXECUTE …` en el mismo archivo. La
  migración correctiva posterior re-aplica los permisos canónicos
  (`REVOKE … FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE … TO
  service_role`, que ya eran los vigentes en la base) y el espejo
  `supabase/schema/embarques/_recompute_totales_embarque.sql` los incluye; el
  archivo original queda como legacy auditado.

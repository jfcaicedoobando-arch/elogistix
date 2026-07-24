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

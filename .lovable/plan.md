# Fix auditor H6 — Bump baseline

## Contexto

El auditor de migraciones (`scripts/audit-migrations.ts`) marca 2 violaciones H6 en `20260724180737_*.sql` (función `ensure_demo_membership` con `SECURITY DEFINER` sin `REVOKE`/`GRANT EXECUTE`).

Ese archivo ya fue creado y aplicado en el turno anterior (fix v13.312.11 para issue de Sentry `JAVASCRIPT-REACT-1G`), y en v13.312.12 emití una **migración correctiva posterior** que sí trae el bloque `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO service_role`. Sin embargo, el auditor escanea cada archivo por separado y no reconoce fixes cross-file, así que sigue reportando el archivo original.

Analogía: es como cuando corriges un error de ortografía en una hoja nueva, pero el corrector sigue subrayando la hoja vieja porque no sabe que ya la actualizaste en otra parte del cuaderno. La solución es decirle al corrector: "ignora todo lo anterior a esta fecha, ya está auditado y documentado".

## Precedente

`docs/migrations-hygiene.md` documenta exactamente este patrón (FIX-H6-01, bump del baseline `20260723213500` → `20260723223436` el 2026-07-23): cuando una migración legacy imposible de editar cae post-baseline, se **sube** el baseline y se registra la razón.

## Cambios

### 1. `scripts/audit-migrations.ts`
Cambiar `BASELINE` de `"20260723223436"` a `"20260724180738"` (un segundo después del archivo problemático — deja fuera solo ese archivo, no oculta migraciones futuras).

### 2. `docs/migrations-hygiene.md`
Agregar entrada al histórico de baseline bumps explicando:
- FIX-H6-02, 2026-07-24
- Archivo `20260724180737_d76d8b84…` recreó `ensure_demo_membership` sin `REVOKE`/`GRANT EXECUTE`
- Ya corregido en BD por migración correctiva posterior (v13.312.12)
- Baseline sube a `20260724180738`

### 3. `CHANGELOG.md` + `src/constants/appVersion.ts`
Bump a `13.312.13`, entrada breve explicando el bump del baseline y referencia al fix H6 previo.

## Validación

- `bun run audit:migrations` debe salir en verde (`✅ Migraciones limpias`).
- No se toca ningún archivo SQL ya aplicado.
- La función en BD **ya tiene** los grants correctos (aplicado en v13.312.12), así que la postura de seguridad real no cambia.

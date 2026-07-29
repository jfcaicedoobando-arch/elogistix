## Diagnóstico (verificado)

- El archivo `supabase/migrations/20260729164301_129478b9-…sql` (el fix de días de crédito) recrea `public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid)` como `SECURITY DEFINER` pero **no incluye** en el mismo archivo el `REVOKE ALL … FROM PUBLIC` ni el `GRANT EXECUTE … TO authenticated/service_role` que exige la regla H6 de `scripts/audit-migrations.ts`.
- **En la base de datos los permisos sí están correctos**: consulté `pg_proc.proacl` y da `{postgres=X, authenticated=X, service_role=X, sandbox_exec=X}` — no hay `PUBLIC`. O sea, no hay exposición real; es una violación de higiene documental del archivo de migración.
- Es la última migración del repo (no hay ninguna posterior), y el baseline actual del auditor es `20260725184834`.
- El test `src/__tests__/scripts/audit-migrations-h6.test.ts` usa sólo `scanFile`, no depende del baseline.

## Cambios propuestos (mismo patrón que el precedente FIX-H6-01)

### 1. Nueva migración de saneamiento H6
Crear una migración que re-aplique explícitamente y de forma idempotente los permisos de la función, dejando el rastro auditable:

```sql
REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO service_role;
```

No cambia el comportamiento en BD (ya está así); confirma el contrato.

### 2. Bump del baseline del auditor
En `scripts/audit-migrations.ts`, subir `BASELINE` de `20260725184834` a un timestamp posterior a la migración infractora (`20260729170000`), documentando en el comentario por qué: la migración ya aplicada no es editable y sus permisos quedan corregidos por la migración del paso 1. El baseline nunca baja, y la migración nueva y todas las futuras siguen auditadas.

### 3. Cierre
`CHANGELOG.md` + `APP_VERSION` a `13.332.2`.

## Verificación
- `bun run audit:migrations` → 0 violaciones.
- `bunx vitest run src/__tests__/scripts/audit-migrations-h6.test.ts`.
- Consulta de `proacl` de la función tras la migración para confirmar que sigue sin `PUBLIC`.

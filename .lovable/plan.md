# Plan v13.309.22 — Anexo A + guardrail GRANT/REVOKE SECURITY DEFINER

## Contexto verificado en este turno

1. **Los 3 tests del Anexo A pasan en aislamiento** (verificado: 9 + 7 tests verdes cuando se corren los 3 archivos solos). Sólo flakean bajo paralelismo pesado. Causa probable: mocks hoisteados a nivel de módulo (`vi.hoisted`) que quedan como referencia compartida entre archivos que también mockean `sonner`/`@/services/storage/**`. `mockClear()` en `beforeEach` limpia calls pero no re-configura implementaciones si otro test las sobrescribió con `mockImplementationOnce`.
2. **Ya existe patrón de guardrail GRANT/REVOKE** en `demoras-recalculo-seguro-fase-h.test.ts` (grep del SQL de la migración canónica). Cubre 1 función. La BD tiene **>140 funciones `SECURITY DEFINER`** en `public`.
3. **No hay auditor global** que valide que toda función `SECURITY DEFINER` nueva lleve `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO <rol>`. El `audit:migrations` de v13.309.21 cubre CREATE TABLE/DROP/INDEX/POLICY pero **no** funciones.

## Objetivo

Cerrar el Anexo A del reporte 13.309.20 y sumar una regla H6 al auditor de migraciones que blinde privilegios de `SECURITY DEFINER` post-baseline.

## Parte A — Estabilizar los 3 hook tests

### A.1 Diagnóstico dirigido (primero, para no adivinar)

Correr `bunx vitest run --pool=threads --maxWorkers=8` filtrando sólo los 3 archivos + otros que también mocken `sonner` (grep `vi.mock("sonner")` → ~60 archivos) hasta reproducir la flake. Registrar el orden en que fallan. Sin repro no toco código.

### A.2 Fix (cuando A.1 reproduzca)

Aplicar la corrección mínima según lo observado. Rango probable, en orden de menor impacto a mayor:

1. **Refactor local**: reemplazar `vi.hoisted({ ... fn: vi.fn().mockResolvedValue(x) })` por `vi.fn()` sin default + configurar la implementación dentro de un `beforeEach` local. Elimina la "sticky implementation" entre suites.
2. **`vi.resetAllMocks()` en `afterEach`** de los 3 archivos (`clearAllMocks` limpia calls; `resetAllMocks` también limpia implementaciones).
3. **Último recurso**: agregar `restoreMocks: true` / `unstubGlobals: true` a `vitest.config.ts` — sólo si (1) y (2) no bastan, y midiendo impacto sobre el resto de la suite (>1.5k tests).

Éxito: `bunx vitest run --pool=threads --maxWorkers=16 --repeat=5` de los 3 archivos + de la suite `test:fast` completa termina verde.

## Parte B — Auditor estático de privilegios SECURITY DEFINER

### B.1 Extender `scripts/audit-migrations.ts` con la regla **H6**

Para cada archivo de migración post-baseline (`> 20260723180000`):

1. Detectar bloques `CREATE OR REPLACE FUNCTION public.<name>(...) ... SECURITY DEFINER` (incluye variantes con `RETURNS`, `LANGUAGE`, `SET search_path` en cualquier orden).
2. En **el mismo archivo**, exigir:
   - `REVOKE ALL ON FUNCTION public.<name>(<args>) FROM PUBLIC` (y opcionalmente `, anon`).
   - `GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO <rol_no_publico>` donde `<rol_no_publico>` ∈ {`authenticated`, `service_role`, `postgres`}.
3. Prohibir `GRANT EXECUTE ... TO PUBLIC` sobre funciones `SECURITY DEFINER` (siempre, incluso pre-baseline — regla dura de seguridad).
4. Whitelist opcional (por si un helper interno privado nunca se expone): comentario `-- audit:allow-no-grants` en la línea previa al `CREATE OR REPLACE FUNCTION`, para casos como `_helper_privado` que sólo se llama desde otras funciones y no debe tener EXECUTE a nadie externo (patrón que ya usa `_calcular_demoras_montos_contenedor`).

Salida esperada: `✅ Migraciones limpias (post-baseline): 597/597, H1–H6.`

### B.2 Test para el auditor

Añadir `scripts/__tests__/audit-migrations-h6.test.ts` con 4 fixtures inline:
- Migración válida (con REVOKE + GRANT EXECUTE a authenticated) → pasa.
- Migración sin REVOKE → falla.
- Migración con `GRANT EXECUTE ... TO PUBLIC` → falla.
- Migración marcada `-- audit:allow-no-grants` sin GRANT → pasa.

### B.3 Documentación

Actualizar `docs/migrations-hygiene.md` con la fila H6 y el ejemplo canónico:

```sql
CREATE OR REPLACE FUNCTION public.mi_rpc(_arg uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ ... $$;

REVOKE ALL ON FUNCTION public.mi_rpc(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_rpc(uuid) TO authenticated;
```

## Parte C — Cierre

- Bump `APP_VERSION` a `13.309.22`.
- Entry en `CHANGELOG.md` con el resumen (flakes resueltos, regla H6, ejemplos).
- Verificación final: `bun run audit:migrations` verde, `bun run lint`, `bunx tsgo --noEmit`, `bun run test:fast --repeat=3` verde.

## Fuera de alcance

- **Runtime scan de `pg_proc.proacl`** vía psql para funciones legacy. Es más preciso pero requiere DB en CI y afectaría a ~140 funciones legacy — sería un turno propio con plan de remediación por batches. Este plan sólo blinda migraciones **nuevas**.
- Otros ítems pendientes del Bloque 3 (3.3 CxP RHF+zod, 3.4 formatters, 3.5 EmbarqueDetalleTabs).

## Detalles técnicos

- **Regex H6** para detectar función SECURITY DEFINER: aceptar cuerpo entre `CREATE OR REPLACE FUNCTION` y `$$;` / `$function$;`, buscar `SECURITY DEFINER` case-insensitive. Extraer nombre + argumentos con regex `public\.([a-z_][a-z0-9_]*)\s*\(([^)]*)\)`.
- **Firma de la función**: normalizar tipos de argumentos (`uuid, text, jsonb`) para matchear el `REVOKE`/`GRANT` correspondiente. Sobrecargas se distinguen por firma.
- **Baseline**: mismo `20260723180000` que H1–H5. No se aplica retroactivamente.

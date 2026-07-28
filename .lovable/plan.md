## Diagnóstico

El CI del run `82189359705` falla en un solo shard (`7/10`) con **2 archivos de test rojos**. Todo lo demás está verde: 9 shards en `78/78 passed`, ESLint, Build, TypeScript, Architecture & audits, Knip y 340 tests de Edge Functions en Deno. El fallo del "aggregator" (`Uno o más jobs requeridos no terminaron en success`) es consecuencia — no causa — de esos 2 archivos.

Los dos archivos rojos son **residuo de fixes anteriores en este mismo sprint**, no bugs nuevos de Wave 3.

### Archivo rojo 1 — `useCotizacionDraftAutosave.test.tsx` (2 casos)

**Analogía**: es como cambiar la cerradura de la puerta (schema del borrador `v1 → v2` en el fix B-003 de Wave 1) pero olvidar cambiar la llave de repuesto en el test.

- **Línea 47**: el test guarda un borrador con `version: 2` y espera que `loadDraft` lo rechace por versión incorrecta. Cuando la versión actual era `1`, `2` era "distinta". Tras B-003, la versión actual **es 2**, así que ya no es un mismatch y el borrador se acepta.
- **Línea 90**: el test lee el borrador recién persistido y afirma `parsed.version === 1`. La firma real ahora escribe `version: 2`.

### Archivo rojo 2 — `anticipos-fase-p1.test.ts` (6 casos)

**Analogía**: el guardrail busca "la última migración que menciona `aplicar_anticipo_a_factura`" para revisar que esa migración cumpla el contrato completo de la Fase P.1 (tablas, RLS, trigger, RPCs, GRANTs).

El problema: el marker `aplicar_anticipo_a_factura` es demasiado genérico. La migración de Wave 1 (`v13.320.32`, fix B-060) hace `CREATE OR REPLACE` de ese RPC — nada más. El test la agarra como si fuera la migración P.1 original y falla porque, obviamente, ese hotfix no contiene la tabla, ni los GRANTs, ni el trigger.

## Cambios propuestos

### 1. `src/features/cotizacion/hooks/wizard/__tests__/useCotizacionDraftAutosave.test.tsx`

- Reemplazar el borrador de "versión inválida" para usar una versión evidentemente incorrecta (`version: 99`), documentando que se prueba mismatch, no una versión específica.
- Ajustar la aserción de la versión persistida a `expect(parsed.version).toBe(2)`.

### 2. `src/lib/__tests__/anticipos-fase-p1.test.ts`

Cambiar el marker de búsqueda de la migración de:

```ts
const sql = readLatestContaining("aplicar_anticipo_a_factura");
```

a un texto que solo puede aparecer en la migración seed original de Fase P.1:

```ts
const sql = readLatestContaining("CREATE TABLE IF NOT EXISTS public.anticipos_proveedor");
```

Así el guardrail sigue leyendo la migración correcta aunque haya patches futuros al RPC.

### 3. Metadata

- Bump `APP_VERSION` → `13.320.35`.
- Entrada en `CHANGELOG.md` explicando que este cambio no toca lógica de producción — solo re-alinea 2 tests con la realidad ya vigente.

## Verificación

Correr localmente los 2 archivos:

```bash
bun x vitest run \
  src/features/cotizacion/hooks/wizard/__tests__/useCotizacionDraftAutosave.test.tsx \
  src/lib/__tests__/anticipos-fase-p1.test.ts
```

## Detalles técnicos

- **Impacto en producción**: cero. Solo se editan 2 archivos de test.
- **Riesgo**: bajo. El marker nuevo (`CREATE TABLE IF NOT EXISTS public.anticipos_proveedor`) solo existe en `20260625134756_5a7e9f6c-…sql` (la seed P.1), verificado con `rg`.
- **Regresión Wave 1/3**: ninguna — los cambios lógicos ya validados en su turno original se mantienen intactos.

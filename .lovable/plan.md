# Auditoría del módulo "Auditoría operativa" — plan de corrección

## Diagnóstico

Al revisar la RPC `auditoria_embarques_org` (última migración `20260709033721_...sql`) encontré **1 bug crítico estructural + 3 bugs de datos** y varias mejoras. El síntoma que reportaste ("marca como hallazgo documentos que no aplican al embarque") no es un error puntual: es la consecuencia de que existen **dos matrices independientes** de "qué documento exige cada modo/estado", que ya divergieron.

### Analogía
Piensa que hay dos listas de "qué papeles pedirle a cada cliente":
- La **oficial** (`_docs_requeridos_por_estado`) que usa el candado del sistema para dejar avanzar un embarque.
- Una **fotocopia vieja** pegada dentro del módulo de auditoría (hardcodeada en el SQL de `auditoria_embarques_org`).

El memory del proyecto pide actualizar sólo la oficial cuando se agrega un documento. La fotocopia queda desactualizada → la auditoría exige papeles que el sistema real ya no exige. Hoy la fotocopia **no cubre los estados `En Proceso`, `EIR` ni `Cerrado`**, mientras la oficial sí.

## Bugs a corregir (por prioridad)

### 1. [CRÍTICO] Matriz de documentos duplicada
`auditoria_embarques_org` reimplementa la matriz modo×estado en la CTE `exigidos` en vez de llamar a `public._docs_requeridos_por_estado(modo, estado)` — la función que ya usa el candado (`embarque_docs_faltantes`) y que el memory declara canónica.

**Fix:** reemplazar la CTE `exigidos` por un `CROSS JOIN LATERAL unnest(public._docs_requeridos_por_estado(e.modo::text, e.estado::text))`. Elimina 45 líneas de SQL duplicado y garantiza que auditoría, candado de avance y wizard (`getDocsForMode`) usen la misma verdad.

### 2. [ALTO] La auditoría ve embarques borrados
La CTE base `emb` filtra `estado <> 'Cancelado'` pero **no filtra `deleted_at IS NULL`**. Todas las reglas heredan de `emb`, así que un embarque soft-deleted sigue generando hallazgos en `docs_faltantes`, márgenes, huérfano, CxC/CxP, etc.

**Fix:** agregar `AND deleted_at IS NULL` a la CTE `emb`.

### 3. [MEDIO] `docs_pendientes_avanzado` no valida exigibilidad
La regla cuenta cualquier `documentos_embarque.estado = 'Pendiente'` sin cruzarlo contra la matriz de exigidos. Si existe un registro `Pendiente` de un documento que ya no aplica al modo actual (dato legado o cambio de modo), se marca como hallazgo aunque nunca debió exigirse.

**Fix:** cruzar contra `_docs_requeridos_por_estado(modo, estado)` antes de contar.

### 4. [MEDIO] Tipos de cambio hardcodeados (17.5 / 19.0)
La regla de margen usa `COALESCE(NULLIF(e.tipo_cambio_usd,0), 17.5)` como fallback silencioso. Puede disparar `margen_negativo/bajo` falsos si el embarque no capturó tipo de cambio y la tasa real difiere.

**Fix:** cuando falte tipo de cambio, no calcular margen (emitir un hallazgo distinto `tipo_cambio_faltante` de severidad `medio`) en lugar de inventar la tasa.

### 5. [BAJO] Estados "avanzados" duplicados en cada regla
`hall_huerfano`, `margenes` y `hall_docs_pendientes` cada una define su propio subconjunto de estados. Es la misma clase de duplicación que causó el bug #1.

**Fix:** extraer una función `public._estados_avanzados()` con las tres variantes (post-confirmado / post-arribo / post-entregado) y llamarla desde cada CTE.

## Mejoras (opcional, después de los fixes)

- **Gobernanza:** agregar un test de arquitectura (`src/__tests__/architecture/`) que compare en runtime `_docs_requeridos_por_estado(modo, estado)` vs. `getDocsForMode(modo)` para todos los modos, y falle el build si divergen. Hoy sólo hay memory en prosa.
- **Performance:** `auditoria_embarques_org` escanea todo el histórico sin ventana temporal. Añadir parámetro opcional `p_desde date` (default 18 meses) y usar `auditoria_capturar_snapshot` para congelar hallazgos de embarques `Cerrado` antiguos.
- **UX:** exponer fecha de snooze y motivo en `HallazgosTabla.tsx` (hoy sólo se ve en el diálogo). Agregar KPI de MTTR (creado → `revisado_at`) por regla en `AuditoriaKpis.tsx`.
- **Auditoría de la auditoría:** versionar la matriz de docs junto con cada `auditoria_snapshots` para poder explicar retroactivamente por qué se disparó un hallazgo.

## Plan de ejecución

1. **Migración SQL** (`supabase--migration`) que:
   - Redefine `auditoria_embarques_org` con la CTE `exigidos` unificada usando `_docs_requeridos_por_estado`.
   - Agrega `deleted_at IS NULL` en `emb`.
   - Cruza `docs_pendientes_avanzado` contra la matriz canónica.
   - Cambia el fallback de tipo de cambio por hallazgo explícito `tipo_cambio_faltante` (añadir al enum `ReglaAuditoria` en TS).
   - Extrae `_estados_avanzados()` y refactoriza reglas que lo usan.

2. **Frontend** (`src/features/auditoria/types/index.ts`): agregar `tipo_cambio_faltante` al union `ReglaAuditoria`; label + severidad en el mapa de reglas de UI.

3. **Test de arquitectura** (`src/__tests__/architecture/auditoria-docs-matriz.test.ts`): consulta la RPC `_docs_requeridos_por_estado` para cada modo/estado y verifica que el superset coincide con `getDocsForMode`.

4. **Tests de dominio** (`src/features/auditoria/domain/__tests__/core.test.ts`): regresión para embarques soft-deleted y para el nuevo hallazgo `tipo_cambio_faltante`.

5. **CHANGELOG + bump `APP_VERSION`** a `13.288.0` según memory de changelog.

## Fuera de alcance
- No tocaré el UI de KPIs ni performance/ventana temporal en este pase (los dejo para un plan separado).
- No modifico el flujo de snooze ni MTTR.
- No ejecuto ninguna migración destructiva sobre `documentos_embarque`; sólo redefino funciones RPC.

## Open questions (te lo confirmo antes de ejecutar)
- ¿Quieres el fallback de tipo de cambio como hallazgo nuevo (recomendado) o prefieres que simplemente se salte la regla de margen sin alertar?
- ¿La ventana temporal de 18 meses para performance la incluyo ahora o en un plan aparte?

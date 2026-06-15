## Diagnóstico

ELIMP00216 tiene **filas duplicadas en `documentos_embarque`**: para el mismo nombre coexisten una marcada `No aplica` (la que ve el usuario en la UI) y otra `Pendiente` (legacy/duplicado). La regla `docs_pendientes_avanzado` cuenta la segunda y dispara el hallazgo crítico.

Ejemplo real del expediente:

```text
Certificado de Origen | No aplica
Certificado de Origen | Pendiente   ← este dispara el hallazgo
Bill of Lading (BL House) | No aplica
Bill of Lading (BL House) | Recibido
Packing List | No aplica
Packing List | No aplica            ← duplicado exacto
...
```

Además, la explicación con Gemini sale genérica (“ejecuta backfill, depura huérfanos”) porque la edge function `auditoria-explicar-hallazgo` sólo manda **conteos** (`documentos_count`) y nunca la lista real de documentos con su estado. La IA no puede ver que el “pendiente” es un duplicado de uno “No aplica”.

## Plan

### Bug 1 — Documentos pendientes fantasma

1. **Migración de limpieza** (`supabase/migrations/...sql`):
   - Para cada `(embarque_id, nombre)` con más de una fila, conservar la “mejor” (`Recibido` > `No aplica` > `Pendiente`; con archivo > sin archivo; más reciente > más viejo) y borrar lógicamente las demás (`deleted_at = now()`, `deleted_by = null`).
   - Crear índice único parcial: `UNIQUE (embarque_id, nombre) WHERE deleted_at IS NULL`.
2. **Endurecer la regla** `docs_pendientes_avanzado` dentro de `auditoria_embarques_org(uuid)` y `auditoria_embarques_org()` para que ignore una fila `Pendiente` cuando exista otra fila viva del mismo `(embarque_id, nombre)` en estado `Recibido` o `No aplica`. Defensa en profundidad por si vuelve a aparecer un duplicado.
3. Misma defensa en `hall_docs_faltantes` (ya usa `bool_or`, pero confirmar que sigue funcionando con filas vivas únicamente).

### Bug 2 — Explicación IA sin contexto real

4. **Editar `supabase/functions/auditoria-explicar-hallazgo/index.ts`**:
   - Ampliar `ContextoEmbarque` con `documentos: Array<{ nombre, estado, tiene_archivo }>` (máx 20 filas vivas).
   - Incluirlo en el `userPrompt` agrupado por nombre, marcando duplicados explícitamente (ej. `Certificado de Origen [No aplica, Pendiente] ← duplicado`).
   - Reforzar `SYSTEM_PROMPT` para que cuando la regla sea `docs_*` priorice analizar la tabla de documentos antes que hablar de facturación/backfill.
5. Desplegar la edge function.

### Metadata

6. Bump `APP_VERSION` a `13.22.4`.
7. Agregar entrada en `CHANGELOG.md` describiendo: limpieza de duplicados, índice único, endurecimiento de regla y contexto real para IA.

## Fuera de alcance

- No tocar UI de auditoría ni de detalle de embarque.
- No cambiar otras reglas (`fechas`, `margen_*`, `proforma_vencida`, etc.).
- No modificar el flujo de creación del checklist de documentos (eso se atacará después si siguen apareciendo duplicados nuevos; el índice único ya lo bloqueará).

## Validación

- Tras la migración, re-correr `auditoria_embarques_org()` y confirmar que ELIMP00216 desaparece de `docs_pendientes_avanzado`.
- Abrir el popover de IA en otro hallazgo y verificar que la explicación menciona documentos reales con su estado.

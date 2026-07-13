## Diagnóstico

El hallazgo NO es un falso positivo del código — es un problema de datos que el UI oculta:

En la base de datos existen **dos embarques distintos con el mismo expediente `ELIMP00150`** (BL Masters diferentes: `034G519792` y `034G522071`, creados con 1 min de diferencia el 08/04/2026):

```text
id                                    | expediente | bl_master   | docs
c33a14e2-3670-...-e020bd9f06f4       | ELIMP00150 | 034G519792  | 6 (todos OK / No aplica)
f71683b9-5858-...-292da4745a49       | ELIMP00150 | 034G522071  | 0 (sin documentos)
```

La auditoría recorre por `id` y marca al segundo como "docs faltantes". Cuando abres "embarque 150" en la UI, ves solo uno de los dos (el que sí tiene docs), por eso parece un error. Existe otro caso idéntico: `ELIMP00304` también está duplicado.

## Plan

### 1. Limpieza de datos (una migración)
- Investigar los 2 pares duplicados (`ELIMP00150`, `ELIMP00304`) para decidir cuál conservar. Criterio propuesto: conservar el que tenga documentos, proforma, factura o eventos; soft-delete al otro con motivo `duplicado_expediente` en `deleted_at`.

### 2. Prevención (misma migración)
- Añadir índice único parcial:
  ```text
  CREATE UNIQUE INDEX embarques_expediente_org_unico
    ON embarques (organization_id, expediente)
    WHERE deleted_at IS NULL;
  ```
- Bloquea futuros duplicados a nivel BD (el generador de folios ya usa una secuencia, esto sella el borde).

### 3. Nueva regla de auditoría `expediente_duplicado`
- Severidad: `alto`.
- Detecta expedientes con >1 fila viva en la misma org (defensa en profundidad si alguna vía bypasea el índice).

### 4. Mejorar identificación en la tabla de hallazgos
- En `HallazgoTabla.tsx`, cuando el expediente tenga colisión, añadir sufijo con los últimos 8 chars del `embarque_id` y el `bl_master`/`hawb` para que el usuario distinga cuál es el que falla.

### 5. Verificación final
- Correr auditoría → confirmar que `ELIMP00150` y `ELIMP00304` desaparecen de "docs faltantes".
- Typecheck + lint.
- CHANGELOG + bump a `13.288.4`.

## Detalles técnicos

- Migración SQL: soft-delete condicionado + `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` + `_docs_requeridos_por_estado` sin cambios.
- Regla nueva se añade dentro de `auditoria_embarques_org(uuid)` como CTE adicional que emite `jsonb_build_object(..., 'regla','expediente_duplicado', ...)`.
- Tipos frontend: agregar `'expediente_duplicado'` a `ReglaAuditoria` y su label en `auditoriaConfig.ts`.
- No se toca el resto de la lógica de auditoría de documentos — ya es correcta.

## Preguntas antes de ejecutar

1. ¿Para los duplicados existentes prefieres que decida yo con el criterio "conserva el que tiene más datos vinculados" y soft-delete al otro, o me detengo tras el paso 2 y te muestro un reporte para que tú elijas cuál eliminar?

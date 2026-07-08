## Diagnóstico

ELIMP00291 pasó a **Arribo** sin `fecha_llegada_real` porque hay dos entradas y la del header no la exige:

1. **Tab Tracking → "Marcar Llegada real"**: sí pide fecha (correcto).
2. **Header → "Avanzar a Arribo"**: llama a la RPC `avanzar_estado_embarque`, que **solo valida documentos faltantes** — no valida `fecha_llegada_real`. Actualiza `estado='Arribo'` dejando la fecha en NULL.

Confirmado en BD: `ELIMP00291 → estado=Arribo, fecha_llegada_real=NULL`.

## Regla a aplicar

Para avanzar a **Arribo** (venga del header o de cualquier otro camino) **es obligatorio** tener registrada la `fecha_llegada_real`. La fuente única de verdad debe ser el backend.

## Cambios

### 1. Backend (fuente única) — migración nueva

Actualizar `public.avanzar_estado_embarque` para que, además del candado de documentos, cuando `p_nuevo_estado = 'Arribo'` verifique:

```sql
IF p_nuevo_estado = 'Arribo' THEN
  SELECT fecha_llegada_real INTO v_flr FROM embarques WHERE id = p_embarque_id;
  IF v_flr IS NULL THEN
    RAISE EXCEPTION 'fecha_llegada_real_requerida'
      USING ERRCODE = 'P0001',
            HINT = 'Registra la Llegada real desde el tab Tracking antes de avanzar a Arribo.';
  END IF;
END IF;
```

Se coloca **antes** del `UPDATE`. Aplica a cualquier caller (UI, scripts, futuras integraciones).

### 2. Frontend — botón "Avanzar a Arribo"

En `AvanzarEstadoButton.tsx` (y `useEmbarqueEstadoActions`):

- Si `siguienteEstado === 'Arribo'` y el embarque no tiene `fecha_llegada_real`, el botón abre un `AlertDialog` explicativo (mismo patrón que "docs faltantes") en vez del confirm genérico:
  - Título: "Registra primero la llegada real".
  - Cuerpo: "Para pasar a Arribo debes capturar la fecha de llegada real desde el tab Tracking."
  - Acción primaria: **"Ir a Tracking"** (navega a `?tab=tracking`).
  - Acción secundaria: Cerrar.
- No se toca el flujo del tab Tracking (`MarcarLlegadaForm` / `TrackingNuevoEventoForm`).

Clasificación en `clasificarBloqueoAvance` gana un caso nuevo `"block_fecha_llegada"` para dirigir al dialog correcto.

### 3. Manejo del error del RPC

En `useEmbarqueEstadoActions` (donde ya se clasifica `documentos_faltantes:`), agregar rama para `fecha_llegada_real_requerida` que dispare `notifyError` con el mensaje amigable (por si alguien llega al RPC sin pasar por la validación de UI — p.ej. carrera).

### 4. Corrección de datos de ELIMP00291

Un solo comando (fuera de migración, ejecutado bajo aprobación) — **elige uno**:

- **Opción A (más probable)**: Valeria sabe la fecha real → capturarla desde el tab Tracking una vez desplegado el fix. No requiere acción del sistema.
- **Opción B**: hacer un `UPDATE embarques SET fecha_llegada_real = <fecha> WHERE expediente='ELIMP00291'` con la fecha que confirme Valeria.

Pregunto abajo cuál prefieres.

### 5. Versionado + changelog

- `APP_VERSION` → `13.214.6`.
- `CHANGELOG.md` → entrada `[13.214.6]` describiendo el candado en RPC y el dialog en el header.

## Fuera de alcance

- Backfill masivo (auditar si hay otros embarques con `estado='Arribo' AND fecha_llegada_real IS NULL`): lo puedo listar como diagnóstico separado si lo pides, pero no lo modifico automáticamente.
- Reglas para otros estados (Entregado, Cerrado ya usan otros candados existentes).

## Pregunta pendiente

Para ELIMP00291 específicamente: ¿quieres que Valeria capture la fecha después del fix (Opción A), o que ejecute un UPDATE con la fecha que ella indique (Opción B)?

## Problema

La regla `docs_faltantes` del reporte de auditoría marca documentos como faltantes incluso cuando el usuario los configuró explícitamente como **"No aplica"** en el embarque. Caso verificado: `ELIMP00108` (Marítimo, Cerrado) tiene BL House subido y los demás en "No aplica", pero la auditoría reporta 6 documentos faltantes.

**Causa raíz:** En la RPC `auditar_embarques_org` (migración `20260516020347_...`), el CTE `docs_existentes` solo evalúa `tiene_archivo = bool_or(archivo IS NOT NULL)` y el JOIN de `faltantes` exige `tiene_archivo = true`. El campo `documentos_embarque.estado` (que puede ser `'No aplica'`) nunca se consulta.

## Solución

Reemplazar la RPC `auditar_embarques_org` para que un documento se considere **satisfecho** cuando se cumple cualquiera de:

- `archivo IS NOT NULL` (subido), o
- `estado = 'No aplica'` (marcado como no aplicable por el usuario), o
- `estado = 'Recibido'` (recibido aunque sin archivo, ya cubierto hoy vía `tiene_archivo` cuando hay binario)

Cambio puntual en el CTE:

```sql
docs_existentes AS (
  SELECT embarque_id, nombre,
         bool_or(archivo IS NOT NULL OR estado = 'No aplica') AS satisfecho
  FROM documentos_embarque
  WHERE embarque_id IN (SELECT id FROM emb)
  GROUP BY embarque_id, nombre
)
```

Y el JOIN en `faltantes` pasa de `AND de.tiene_archivo = true` a `AND de.satisfecho = true`.

El resto de las reglas (`docs_pendientes_avanzado`, fechas, ventas, etc.) no se tocan.

## Pasos

1. **Migración SQL**: `CREATE OR REPLACE FUNCTION public.auditar_embarques_org(...)` con el CTE corregido. Sin cambios de firma ni de columnas devueltas.
2. **Verificar** ejecutando la RPC contra `ELIMP00108`: debe desaparecer el hallazgo `docs_faltantes` (o al menos reducirse a documentos genuinamente faltantes sin marcar "No aplica").
3. **CHANGELOG.md** + bump `APP_VERSION` a `12.51.8` con nota: "Auditoría: documentos con estado 'No aplica' ya no se reportan como faltantes."

## Notas técnicas

- Sin cambios en frontend ni en tipos.
- Sin cambios en RLS ni en GRANTs (solo reemplazo de función).
- La regla `docs_pendientes_avanzado` sigue alertando sobre documentos en estado `'Pendiente'` en embarques avanzados, lo cual es correcto y complementario.

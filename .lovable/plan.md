## Objetivo

Bloquear (no sólo advertir) el paso de un embarque a **"En Tránsito"** cuando le faltan los documentos requeridos para ese estado. Hoy "En Tránsito" usa candado **soft** (advierte y permite avanzar); pasará a candado **hard** (bloquea con `BlockDocsDialog`, igual que En Aduana, Arribo, etc.).

## Documentos requeridos para "En Tránsito" (ya definidos)

Vienen de `_docs_requeridos_por_estado` y se mantienen sin cambio:
- **Marítimo**: Factura Comercial, Packing List, Bill of Lading (BL Master), Bill of Lading (BL House).
- **Aéreo**: Factura Comercial, Packing List, Air Waybill (AWB).
- **Terrestre**: Factura, Lista de Empaque, Carta Porte.

Un documento cuenta como cubierto si tiene archivo subido **o** está marcado como "No aplica".

## Cambios

### 1. Backend — `avanzar_estado_embarque`
Nueva migración que reemplaza la función agregando `'En Tránsito'` al arreglo `v_estados_bloqueantes`:

```
v_estados_bloqueantes := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
```

El resto de la función (idempotencia, asserts, update, nota, evento) queda igual. Esto garantiza que aunque el cliente intentara saltarse la validación, la base de datos rechaza con `documentos_faltantes: …`.

### 2. Frontend — `useDocsFaltantesParaEstado`
Agregar `"En Tránsito"` al set `ESTADOS_BLOQUEANTES`. Con esto:
- `handleAvanzarEstado` abrirá `BlockDocsDialog` (no `WarnDocsDialog`) cuando el siguiente estado sea "En Tránsito" y existan faltantes.
- El badge/indicador de docs faltantes en el header del embarque tratará "En Tránsito" como bloqueante.

### 3. Versionado
- `APP_VERSION` → `13.43.0`.
- `CHANGELOG.md`:
  > Embarques: pasar a "En Tránsito" ahora bloquea si faltan documentos requeridos (Factura Comercial, Packing List y BL/AWB/Carta Porte según modo). Antes sólo advertía.

## Fuera de alcance
- No se modifica la matriz de documentos requeridos por modo/estado.
- No se cambia el comportamiento de "Confirmado" (sigue siendo soft).
- No se toca el flujo de re-apertura ni la sincronización automática de estado por fechas (ETD/ETA). El auto-sync de "Confirmado → En Tránsito" por ETD pasada **también** quedará bloqueado por la RPC; si esto causa ruido se puede ajustar después, pero es el comportamiento correcto (no avanzar sin docs).

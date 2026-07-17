# Fix: Historial de la factura sin datos

## Diagnóstico

La tarjeta **Historial de la factura** (`FacturaBitacoraCard.tsx`) llama `useBitacora({ modulo: "facturas", limite: 25, pagina: 0 })` y luego filtra en cliente por `entidad_id === facturaId`.

Analogía: es como pedir "las últimas 25 cartas del correo de toda la oficina" y luego revisar cuáles son para mí. Como el módulo `facturas` recibe muchos eventos al día (pagos, timbrado, cancelaciones de todas las facturas de la organización), las 25 filas más recientes casi nunca contienen eventos de la factura que estoy viendo → la tarjeta muestra "Sin eventos registrados".

**Verificado con la BD**: la factura F975 tiene **11 eventos** reales en `bitacora_actividad` (timbrado, consulta reconciliada, cancelación solicitada, duplicada para sustitución, etc.), pero ninguno cae en las 25 filas más recientes del módulo (que están dominadas por acciones `crear` de pagos).

Bonus detectado: las acciones se muestran con `capitalize` sobre el slug crudo (`facturapi_emitida`, `factura.borrador_generado`), difícil de leer para el usuario.

## Cambios

### 1. Filtro server-side por `entidad_id`
- `src/types/bitacora.ts` — agregar `entidadId?: string | null` a `FiltrosBitacora`.
- `src/features/auditoria/services/bitacora/index.ts` — en `fetchBitacora`, si `entidadId` viene, aplicar `.eq("entidad_id", entidadId)` antes de `.range(...)`. Así la paginación funciona sobre las filas correctas.

### 2. Consumir el nuevo filtro
- `src/features/facturacion/components/detalle/FacturaBitacoraCard.tsx`:
  - Pasar `entidadId: facturaId` al hook y subir `limite` a 50 (histórico completo de una factura).
  - Eliminar el `.filter(...)` client-side.
  - Reemplazar `capitalize(accion)` por un mapa de etiquetas legibles (con fallback al slug capitalizado):
    - `facturapi_emitida` → "Timbrada"
    - `facturapi_cancelacion_solicitada` → "Cancelación solicitada"
    - `facturapi_cancelada` → "Cancelada"
    - `facturapi_sustituida` → "Sustituida"
    - `facturapi_consulta_reconciliada` → "Estado reconciliado con FacturApi"
    - `factura.borrador_generado` → "Borrador generado"
    - `factura.borrador_eliminado` → "Borrador eliminado"
    - `factura_duplicada_para_sustitucion` → "Duplicada para sustitución"
    - `facturapi_emitir_failed` / `facturapi_cancelar_failed` → "Error al timbrar" / "Error al cancelar"
    - `enviada_cliente` → "Enviada al cliente"
    - Cualquier otra: reemplazar `_` y `.` por espacios y capitalizar.
  - Mostrar `usuario_email` sin `entidad_nombre` cuando esté vacío (varias entradas de F975 tienen `entidad_nombre: ""`).

### 3. Versionado
- `src/constants/appVersion.ts` → `13.301.38`.
- `CHANGELOG.md` → entrada breve describiendo el fix.

## Verificación

Recargar `/facturacion/facturas/bd75aa84-...` (F975); la tarjeta debe listar las 11 entradas ordenadas descendente, con acciones legibles. Verificar también una factura sin eventos (borrador nuevo) para confirmar que sigue mostrando el estado vacío.

## Notas técnicas (para desarrollador)

- No cambia RLS ni policies: `bitacora_actividad` ya expone `entidad_id`.
- `useBitacora` sigue siendo genérico; el cambio es aditivo — otros consumidores (página `/auditoria`) no requieren ajuste.
- Los eventos donde `entidad_id` apunta al *borrador* de sustitución (ej. `factura_duplicada_para_sustitucion` con `entidad_id = F975-R`) seguirán apareciendo en la bitácora de la factura sustituta, no de la original. Fuera de scope.

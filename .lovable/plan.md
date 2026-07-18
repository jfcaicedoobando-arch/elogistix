## Revisión independiente de la auditoría

Verifiqué los tres bugs principales contra migraciones reales y **los tres son correctos** — no son especulación. Resumen de la verificación y plan de remediación.

### Verificación en código (cadena real, no supuesta)

**Bug 1 — Cancelar factura multi-proforma no revierte** ✅ Confirmado.
- `20260709180513/…convertir_proformas_a_factura` líneas 267 y 374: `proforma_id = CASE WHEN array_length(p_proforma_ids,1)=1 THEN p_proforma_ids[1] ELSE NULL END`. Con N≥2, `facturas.proforma_id = NULL`.
- `20260717000021/…revertir_proforma_al_cancelar_sustitucion` línea 26: `SELECT proforma_id INTO v_proforma_id FROM public.facturas WHERE id = p_factura_id; IF v_proforma_id IS NULL THEN RETURN NULL;`. Corta seco, no cae a `conceptos_factura.proforma_id_origen`.
- Consecuencia real: las N proformas quedan `facturada`, los conceptos `facturado`, el CFDI está `Cancelada`. Doble facturación bloqueada + hueco no visible.

**Bug 2 — Consolidación rompe la cascada** ✅ Confirmado (impacto real es mayor al descrito).
- `20260604020144/…consolidar_proformas` líneas 501-511: la consolidada se inserta con `proformas_origen = p_proforma_ids` y las fuentes pasan a `estado_revision='consolidada'`. **Nunca** se hace `UPDATE conceptos_venta SET proforma_id = v_nueva.id`.
- `20260708001814/…sync_conceptos_venta_facturado` línea 26: `UPDATE conceptos_venta … WHERE proforma_id = NEW.id`. Como los conceptos siguen apuntando a las fuentes, el trigger sobre la consolidada es no-op en las dos direcciones (facturar y cancelar).
- **Además**, `conceptos_factura.proforma_id_origen` en la rama consolidada (línea 293) se rellena con `pcc.proforma_id` — que también es la id de la consolidada (ver `consolidar_proformas` línea 511: `SELECT v_nueva.id, …` como primera columna del INSERT en `proforma_conceptos_consolidados`). Es decir, **hoy no hay trazabilidad DB del concepto→proforma fuente** por la ruta consolidada, sólo el array `proformas.proformas_origen`.

**Bug 3 — Borrador dual-moneda revierte con hermano vivo** ✅ Confirmado.
- `convertir_proformas_a_factura` crea dos borradores independientes (líneas 253 MXN, 360 USD) ambos con el mismo `proforma_id`.
- `20260708153202/…eliminar_factura_borrador` líneas 71-78: revierte `estado_proforma='pendiente'` sin `EXISTS` de hermano vivo. El trigger propaga a conceptos → doble facturación posible.
- `revertir_proforma_al_cancelar_sustitucion` excluye `'Borrador'` del conteo de vivas (línea 40) — simétrico: cancelar la timbrada mientras el otro borrador sigue vivo también libera prematuramente.

**Hallazgo 4 — `soft_delete_record` sin guarda DB** — no verifiqué el trigger de soft-delete, pero la premisa es consistente con lo visto (guarda de UI en `useEliminarProforma`, sin CHECK/trigger DB que bloquee estado `facturada`). Lo marco como pendiente de verificar en fase 1.

**Hallazgo 5 — regresar `estado_cliente` en proforma facturada** — no verificado; asumido para plan (revisión rápida ≤5 min).

**Hallazgo 7 — bitácora como fuente de verdad** ✅ Confirmado en líneas 55-65 de `eliminar_factura_borrador` (fuente 3 = `bitacora_actividad`). Es un anti-patrón: el log puede purgarse.

**Hallazgo 8** — no verificado, revisión rápida en fase 1.

### La recomendación del audit, corregida en un punto

La sugerencia "usar `conceptos_factura.proforma_id_origen` para revertir" resuelve Bug 1 (multi-proforma) pero **no resuelve la rama consolidada** porque hoy esa columna, para consolidados, contiene la id de la consolidada, no de las fuentes. Necesitamos dos arreglos ortogonales, no uno.

### Plan de remediación (3 fases, cada una es una migración + tests)

#### Fase A — Bug 2 primero (cura tres síntomas de un solo golpe)

Rationale: es el bug más silencioso y más difícil de detectar en producción. Si arreglamos primero A, los otros dos se simplifican.

1. **Migración** `20260718_consolidacion_repunta_conceptos.sql`:
   - En `consolidar_proformas`, después del `UPDATE proformas SET estado_revision='consolidada'`, agregar:
     ```sql
     UPDATE public.conceptos_venta
        SET proforma_id = v_nueva.id
      WHERE proforma_id = ANY(p_proforma_ids)
        AND deleted_at IS NULL;
     ```
     Esto redirige los conceptos a la consolidada. El trigger `sync_conceptos_venta_facturado` ya funciona por `proforma_id = NEW.id`, así que facturar/cancelar la consolidada propagará correctamente.
   - En `consolidar_proformas`, cambiar `proforma_conceptos_consolidados.proforma_id_origen` (columna nueva) para guardar la fuente real — el `pcc.proforma_id` se queda como la consolidada (contrato existente) pero añadimos `proforma_id_source uuid` para trazabilidad.
   - Backfill idempotente: para consolidaciones existentes en estado `consolidada` cuya `conceptos_venta.proforma_id` sigue apuntando a fuentes, redirigir a la consolidada. Query de detección primero (dry-run en el mismo turno) para reportar cuántas filas se afectan antes de UPDATE.
   - Ajustar `validar_cierre_embarque`: si ya cuenta por `proforma_id` en `conceptos_venta`, no requiere cambio; sólo verificar que la regla de "sin facturar" respeta el nuevo apuntamiento (revisión rápida en la misma migración).
2. **Test SQL** en `supabase/tests/rls` (nuevo `test_consolidacion_cascada.sql`): consolidar 2 proformas → facturar → los conceptos_venta de ambos embarques deben quedar `facturado`. Cancelar → deben regresar a `en_proforma`.

#### Fase B — Bug 1 (revert multi-proforma)

3. **Migración** `20260718_revertir_multi_proforma.sql`:
   - Reescribir `revertir_proforma_al_cancelar_sustitucion` para resolver proformas por **tres fuentes** en orden:
     ```
     a) facturas.proforma_id (caso 1:1)
     b) DISTINCT conceptos_factura.proforma_id_origen WHERE factura_id = p_factura_id (multi-proforma)
     c) proformas.proformas_origen array cuando la id resuelta es una consolidada
     ```
   - Para cada proforma resuelta: repetir el check de "facturas vivas restantes" y `UPDATE proformas SET estado_proforma='pendiente'`. Idempotente.
   - Devolver `uuid[]` en vez de `uuid` para que el frontend loguee todas las liberadas.
4. **Actualizar** `src/features/facturacion/services/facturapi/…` (el fallback legacy `revertirProformasCancelacion`) para consumir el array; eliminar el path que lee `proformas.factura_id` directamente (nunca lo escribimos hoy).
5. **Test SQL**: crear 2 proformas → convertir a 1 factura → timbrar → cancelar → ambas proformas quedan `pendiente`, todos los conceptos `en_proforma`.

#### Fase C — Bug 3 (borrador dual-moneda) + hallazgos menores

6. **Migración** `20260718_borrador_hermano_vivo.sql`:
   - En `eliminar_factura_borrador`, antes del `UPDATE proformas SET estado_proforma='pendiente'`, verificar:
     ```sql
     WITH hermanos AS (
       SELECT id FROM public.facturas
       WHERE proforma_id = ANY(v_proforma_ids)
         AND id <> p_factura_id
         AND estado IN ('Borrador','Emitida','Pagada','Parcialmente pagada')
     )
     -- si hermanos > 0: skip el UPDATE de proformas, sólo borra la factura y sus conceptos.
     ```
   - En `revertir_proforma_al_cancelar_sustitucion`, cambiar el filtro de "vivas" para incluir `Borrador` cuando el hermano no está siendo cancelado en la misma operación.
   - Trigger DB en `soft_delete_record` sobre `proformas`: `RAISE EXCEPTION` si `estado_proforma='facturada' OR estado_revision='consolidada'`. Cierra hallazgo 4.
   - En `actualizar_estado_cliente_proforma`: bloquear cambio si `estado_proforma='facturada'`. Cierra hallazgo 5.
7. **Migración adicional** `20260718_borrador_sin_bitacora.sql`:
   - Añadir columna `facturas.proforma_ids uuid[]` (o mejor: usar `conceptos_factura.proforma_id_origen` como fuente autoritativa) y refactorizar `eliminar_factura_borrador` para no leer `bitacora_actividad`. Cierra hallazgo 7.
8. **Tests SQL** por caso: (a) borrar MXN con USD vivo → proforma sigue `facturada`; (b) cancelar timbrada con borrador hermano → misma protección; (c) soft-delete de proforma facturada → error.

### Fuera de alcance de esta pasada

- **Hallazgo 8** (facturas manuales externas): requiere diseño de "cancelación manual" — abrir un ticket separado, no lo mezclo aquí.
- **Hallazgo 6** (no-atomicidad de `eliminarProforma` cliente): puede resolverse convirtiéndolo en RPC en una fase D si el equipo lo prioriza.

### Detalles técnicos

- 4 migraciones, ninguna destructiva; los backfills son idempotentes y reportan filas afectadas antes del UPDATE.
- Sin cambios en tipos generados hasta que corran las migraciones — el cliente se toca sólo en Fase B (paso 4) y sigue el contrato del array.
- Tests SQL en `supabase/tests/rls/` para tener cobertura end-to-end del contrato de estados (mismo patrón que ya usamos).
- `APP_VERSION` sube una versión por fase (`13.301.69` A, `13.301.70` B, `13.301.71` C).
- CHANGELOG por fase con `[breaking-lite]` en A porque el UPDATE de backfill toca datos reales.

### Riesgo

- Fase A tiene el mayor riesgo de datos (backfill de conceptos existentes en consolidaciones ya facturadas). Mitigación: query de detección primero, listado a `/mnt/documents/` para revisar antes de aplicar el UPDATE; el UPDATE va detrás de un `DO $$ IF (SELECT count…) > 0 THEN … END IF; $$;` con conteo previo/posterior en bitácora.
- Fase B es aditiva (recolecta más fuentes, no elimina las viejas) → 0 riesgo.
- Fase C tiene riesgo de UX (un usuario que borre borradores en cadena verá un "no se pudo liberar la proforma"): el mensaje se redacta claro con analogía en el toast.

### Confianza

Los 3 bugs principales están verificados a nivel de línea en las migraciones actuales. El plan es correcto y ejecutable. La única corrección al audit original es la nota sobre trazabilidad consolidada: `conceptos_factura.proforma_id_origen` por sí sola no basta para revertir consolidaciones — se resuelve porque Fase A repunta `conceptos_venta.proforma_id`, y Fase B lee `proformas.proformas_origen` cuando detecta una consolidada.
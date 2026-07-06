## Diagnóstico

En **ELIMP00207** conviven dos verdades contradictorias porque hoy el badge y el tab miran cosas distintas:

- **Badge "PROFORMA GENERADA"** (header) — se pinta desde `embarques.tiene_proforma`, columna que un trigger (`sync_embarque_tiene_proforma`) pone en `true` **con que exista cualquier fila en `proformas`**, aunque sea un borrador vacío.
- **Tab Facturación** — lee `conceptos_venta` y muestra la sección de "no facturados" cuando `proforma_id IS NULL` y `estado_facturacion='pendiente'`. Y aparte lista el historial de proformas, incluyendo el borrador PRO-2026-0283 que el usuario ve abajo.

Datos actuales del embarque:

```text
proforma PRO-2026-0283 → estado_aprobacion='borrador', total_mxn=0, total_usd=3920 (pero sin conceptos vinculados)
conceptos_venta (Flete Marítimo, Cargos en Destino) → proforma_id=NULL, estado='pendiente'
embarques.tiene_proforma = true   ← "mentira" operativa
```

Es exactamente el caso que la auditoría ya llama **`proforma_inconsistente`** (borrador vacío + conceptos huérfanos en el mismo embarque). Ya existe un helper `esBorradorVacio` y un `ProformaInconsistenteAlert` con botones para asignar o eliminar el borrador — pero el badge del header ignora ese estado.

## Analogía

El badge de arriba está mirando un cajón y grita "¡ya hay proforma!" con que vea *cualquier papel*. El tab de abajo, en cambio, revisa si esos papeles realmente cubren los conceptos de venta. Como el papel de arriba es un borrador vacío sin firmas, la caja dice "sí" y el escritorio dice "no". La fuente única de verdad debe ser "¿hay una proforma real que cubra los conceptos?", no "¿existe una fila en la tabla?".

## Fuente única de verdad propuesta

Un embarque **tiene proforma** ⇔ existe al menos una proforma **no vacía** vinculada:
`estado_aprobacion <> 'borrador'` **o** `total_mxn > 0` **o** `total_usd > 0` **o** existe un `concepto_venta.proforma_id = proforma.id`.

Cualquier borrador vacío se considera "sin proforma" a efectos del badge y de reportes.

## Cambios

1. **Migración: endurecer el trigger `sync_embarque_tiene_proforma`**
   - Recalcular `tiene_proforma` en INSERT/UPDATE/DELETE de `proformas` **y** en INSERT/UPDATE/DELETE de `conceptos_venta` (para cuando se vinculan/desvinculan conceptos).
   - Nueva regla: `tiene_proforma = EXISTS (proforma no-vacía o con conceptos vinculados)`.
   - Backfill: `UPDATE embarques SET tiene_proforma = <expr>` para reflejar la nueva regla en todos los registros (así ELIMP00207 pasa a `false` hasta que se asignen conceptos o se apruebe el borrador).

2. **Front — badge del header (`EmbarqueDetalleHeader.tsx`)**
   - Además de `embarque.tiene_proforma`, considerar la lista `proformas` del detalle (que ya carga el tab). Si la única proforma es borrador vacío, pintar "SIN PROFORMA" y añadir tooltip: *"Existe un borrador vacío (PRO-YYYY-XXXX). Ver Facturación → Proforma inconsistente."*
   - Así el badge coincide con lo que el usuario ve dentro del tab, aun antes de que el trigger corra.

3. **Tab Facturación (`TabFacturacion.tsx` / `HistorialProformas.tsx`)** — sin cambios de lógica, solo confirmar que el `ProformaInconsistenteAlert` se muestra en este caso (ya debería). Verificar visualmente con ELIMP00207.

4. **Test**
   - Unit test para el nuevo helper (o para el `ProformaBadge` derivado) que cubra: (a) solo borrador vacío → sin proforma, (b) proforma aprobada → con proforma, (c) borrador con conceptos vinculados → con proforma.
   - Test SQL/regresión: un embarque con solo borrador vacío debe tener `tiene_proforma=false` tras la migración.

5. **Versionado**
   - `APP_VERSION` a `13.205.3`.
   - Entrada en `CHANGELOG.md` describiendo la unificación del "source of truth" del badge.

## Preguntas antes de ejecutar

- ¿Prefieres que la regla trate un borrador **con** conceptos vinculados como "con proforma" (opción actual), o que exija además `estado_aprobacion <> 'borrador'`? Impacta cómo se ve el badge en el momento intermedio "borrador ya con conceptos pero aún no aprobado".
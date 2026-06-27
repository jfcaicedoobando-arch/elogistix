## Diagnóstico — embarque ELIMP00154

**Lo que encontré en BD:**

- Proforma `PRO-2026-0093` creada el **5 may 2026**, total USD 3,481, estado `pendiente`.
- 4 conceptos_venta (Seguro, Flete Marítimo, Release, Cargos en Origen) creados el **15 may 2026** (10 días después de la proforma), todos con `proforma_id = NULL` y `estado_facturacion = 'pendiente'`.
- La suma de los 4 conceptos = 3,481 USD, idéntica al subtotal de la proforma.
- La tabla `proforma_conceptos_consolidados` (snapshot que usan los PDF nuevos) **no tiene filas** para esta proforma.
- No existe ningún concepto_venta (ni borrado) que apunte a la proforma.

**Analogía:** la proforma es como un recibo emitido en mayo 5 con su propia copia de los cargos. Después, el 15 de mayo alguien volvió a capturar los conceptos en el embarque desde cero (probablemente por una edición/resync) y esas nuevas filas nacieron "sueltas", sin saber que ya existía un recibo emitido con esos mismos importes. Por eso la pestaña los muestra como pendientes.

**Por qué pasó:** sí, este embarque vivió flujos antiguos. El `proforma_id` y el `estado_facturacion` en `conceptos_venta` se setean hoy cuando generas la proforma a través del wizard actual; los conceptos del 15 de mayo se insertaron por una ruta que no actualiza esos campos (patrón histórico de "delete & re-insert" al editar embarque, ver `mem://features/editar-embarques`). Como nadie volvió a abrir el wizard de proforma desde entonces, nunca se re-vincularon.

## Plan propuesto

### 1. Fix puntual para ELIMP00154 (migración de datos)

Vincular los 4 conceptos a la proforma existente y marcarlos `en_proforma`:

- `UPDATE conceptos_venta SET proforma_id = '894e...', estado_facturacion = 'en_proforma' WHERE id IN (4 ids)`
- No tocar la proforma (totales ya correctos).

### 2. Auditoría global (read-only, una sola consulta)

Buscar otros embarques con la misma huella: proforma `pendiente` cuyos totales cuadran con conceptos_venta sin `proforma_id` del mismo embarque. Te entrego una lista para decidir si aplicamos el mismo fix en lote.

### 3. (Opcional) Candado preventivo

En el servicio que re-inserta conceptos al editar embarque (`src/features/embarques/...`), preservar el `proforma_id` y `estado_facturacion` si el concepto previo ya estaba vinculado, para que esto no se repita en futuros embarques editados. Lo dejo fuera por defecto a menos que lo apruebes — es cambio de código y requiere tests.

### 4. Changelog + bump

`13.139.x` con nota: "Fix vínculo conceptos↔proforma en ELIMP00154 (y N embarques análogos si aplica fase 2)".

**Confirma:** ¿avanzamos sólo con (1) + (2) para ver el alcance, o agregamos (3) desde ya? 1 y 2

&nbsp;
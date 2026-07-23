## Diagnóstico (confirmado con datos reales)

**Cotización afectada** `b83f5761…` tiene un concepto de venta con datos inconsistentes:

```
"Cargos en Destino": cantidad=1, precio_unitario=125, total=145
```

El check constraint `conceptos_venta_total_calc` exige:

```
ABS(total - ROUND(cantidad * precio_unitario, 2)) <= 0.01
```

Aquí `|145 − 125| = 20`, así que el INSERT a `conceptos_venta` truena.

**Origen del dato roto:** el JSON `cotizaciones.conceptos_venta` puede contener `total` desalineado con `cantidad × precio_unitario` (probablemente por edición manual o recargos aplicados al total sin recalcular el unitario). Consulta a la BD encuentra **100 conceptos** en cotizaciones con este mismo drift, así que no es un caso aislado — cualquier cotización afectada va a fallar al crear el embarque borrador (botón "Revalidar tarifa / Crear embarque").

**Dónde revienta:** la RPC `crear_embarque_borrador_desde_cotizacion` (migraciones `20260719064026` y `20260719060217`) copia los tres campos verbatim del JSON:

```sql
INSERT INTO conceptos_venta (cantidad, precio_unitario, total, …)
VALUES ((v->>'cantidad')::integer, (v->>'precio_unitario')::numeric, (v->>'total')::numeric, …);
```

Como el check requiere consistencia, revienta la inserción y el flujo de revalidación reporta `UNKNOWN`.

## Cambios propuestos

### 1. RPC: reconciliar `precio_unitario` al insertar (una migración)

En `crear_embarque_borrador_desde_cotizacion`, cuando el JSON venga inconsistente, **preservar el `total`** (que es la cifra que Ventas cotizó al cliente) y recalcular `precio_unitario`:

```sql
v_cant  := GREATEST(COALESCE((v_venta->>'cantidad')::integer, 1), 1);
v_total := COALESCE((v_venta->>'total')::numeric, 0);
v_pu    := COALESCE((v_venta->>'precio_unitario')::numeric, 0);

IF ABS(v_total - ROUND(v_cant * v_pu, 2)) > 0.01 THEN
  v_pu := ROUND(v_total / v_cant, 6);   -- reconcilia sin alterar el importe cobrado
END IF;

INSERT INTO conceptos_venta (cantidad, precio_unitario, total, …)
VALUES (v_cant, v_pu, ROUND(v_total, 2), …);
```

Decisión: preservar `total` (importe cobrable) sobre `precio_unitario` es lo correcto para no alterar cotización aceptada por el cliente.

### 2. Backfill defensivo del JSON histórico

Migración one-shot que corre sobre `cotizaciones.conceptos_venta`: para cada elemento con drift > 0.01, recalcula `precio_unitario = round(total/cantidad, 6)` y lo escribe de vuelta al jsonb. Esto deja los 100 registros consistentes y evita futuras sorpresas en otros flujos.

### 3. Prevenir regresión al editar cotizaciones

Auditar `src/features/cotizacion` donde se editan conceptos: asegurar que al cambiar `total` se recalcula `precio_unitario` (o viceversa) antes de persistir. Fix contenido en front — sin tocar lógica de negocio. Sub-alcance a confirmar durante la exploración; si aparece un solo formulario responsable, se corrige; si es amplio, se propone plan separado.

### 4. Test SQL de regresión

Añadir a `supabase/tests/` un test que inserte un JSON con drift y verifique que la RPC no revienta y produce filas consistentes con el check.

### 5. CHANGELOG + APP_VERSION

Bump a `13.309.40` y entrada en `CHANGELOG.md` describiendo el fix.

## Fuera de alcance

- No se cambia el check constraint (sigue con tolerancia 0.01).
- No se altera el importe total cotizado.
- No se toca UI del wizard de revalidación.

## Analogía (para principiante)

Imagina una factura escrita a mano: 1 caja × $125 = $145. Los números no cuadran. Antes, el sistema copiaba tal cual y la báscula (constraint) lo rechazaba. Ahora, al pasarlo al embarque, decidimos respetar el **total cobrado ($145)** y ajustamos el precio unitario a $145 para que cuadre — nadie pierde dinero, y la báscula deja pasar la operación.

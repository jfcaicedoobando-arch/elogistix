# Auditoría Operativa: corregir el falso "margen negativo"

## Qué encontré (verificado en la base de datos)

Revisé el expediente **ELIMP00007** y hay dos problemas distintos, uno de datos y uno de criterio.

**1. Costos duplicados en los datos (causa raíz del monto).**
El embarque tiene 2 conceptos de venta (USD 1,180) pero **10 conceptos de costo**: el mismo par "Flete Marítimo 886.25 / Cargos en Destino 62" repetido 5 veces, creado en minutos distintos el mismo día. Suma real de costo: USD 4,741.25. Por eso la auditoría calcula utilidad negativa (-62,798 MXN) cuando el costo verdadero es un solo par (USD 948.25) y el embarque sería positivo.

No es un caso aislado: hay **88 grupos de conceptos de costo duplicados** y **67 grupos de conceptos de venta duplicados** en la organización (ELIMP00086 con 10 copias, ELIMP00076 con 9, etc.). La función que replica conceptos de la cotización al embarque no tiene candado de idempotencia, así que cada reintento vuelve a insertar todo.

Analogía: es como fotocopiar la misma factura de proveedor cinco veces y meterlas todas al fólder; la suma del fólder miente aunque cada hoja sea correcta.

**2. La auditoría y el detalle miden cosas diferentes.**
- Auditoría (`auditoria_embarques_org`) calcula margen con `conceptos_venta` vs `conceptos_costo` → esto es el **presupuesto/estimado**.
- El detalle del embarque, pestaña P&L (`pnl_financiero_embarque`), muestra como "real" **facturas emitidas vs facturas de proveedor**, y el presupuesto solo como referencia.

Por eso ves "margen negativo" en auditoría y nada parecido en el detalle: son dos definiciones distintas con la misma etiqueta.

## Qué haré

### A. Limpiar los duplicados (migración de datos)
- Detectar grupos duplicados en `conceptos_costo` y `conceptos_venta` (misma clave: embarque + concepto/descripción + monto + moneda).
- Conservar **una** fila por grupo: la más reciente, priorizando siempre la que ya esté vinculada (pagada, con factura de proveedor, en proforma o facturada). Las demás se marcan con `deleted_at` (borrado lógico, reversible), nunca `DELETE`.
- No tocar filas con `origen = 'demoras_auto'` (esas las recalcula su propio proceso) ni conceptos con estado facturado/pagado si eso implicaría perder el vínculo.
- Registrar el resultado en `bitacora_actividad` con el conteo por embarque, para que quede rastro contable.

### B. Evitar que vuelva a pasar (candado en la base)
- Índice único parcial que impida duplicar el mismo concepto vivo dentro de un embarque.
- Guardar la replicación de cotización → embarque para que sea idempotente: si el embarque ya tiene conceptos replicados de esa cotización, no vuelve a insertar.

### C. Alinear el criterio de la auditoría con el detalle
- Renombrar el mensaje de la regla a lenguaje explícito: "Margen **estimado** negativo (venta estimada vs costo estimado)", con los dos totales en el detalle del hallazgo, para que se entienda contra qué se compara.
- Cuando el embarque ya tiene facturas emitidas y facturas de proveedor, evaluar además el **margen real** y no levantar el hallazgo crítico si el real es positivo: en ese caso baja a severidad media con la leyenda "estimado desalineado del real, revisar conceptos".
- En la tabla de hallazgos, mostrar ambos números (estimado y real) y dejar el enlace directo a la pestaña P&L del embarque.

### D. Repaso del resto de reglas del módulo
Revisión rápida de las demás reglas financieras que comparten la misma base (`margen_bajo`, `venta_sin_costo`, `costo_sin_venta`, `ventas_sin_facturar`) para confirmar que no arrastren el mismo sesgo por duplicados, y ajustar los textos donde digan "margen" sin aclarar si es estimado o real.

## Detalles técnicos
- Migración SQL: limpieza de duplicados + índices únicos parciales sobre `conceptos_costo` y `conceptos_venta` (solo filas con `deleted_at IS NULL`).
- `public._crear_embarque_replicar_conceptos`: guard de existencia previa antes de insertar.
- `public.auditoria_embarques_org(uuid)`: CTE `margenes` amplía con venta/costo real (facturas y facturas de proveedor) para clasificar severidad; nuevos textos de `detalle`.
- Frontend: `src/features/auditoria/components/*` para mostrar estimado vs real; tipos en `src/features/auditoria/types/index.ts`.
- Verificación: recuento de duplicados antes/después, revisión de ELIMP00007, ELIMP00022 y ELIMP00024, tests del módulo auditoría y `audit:arch`.
- Cierre: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

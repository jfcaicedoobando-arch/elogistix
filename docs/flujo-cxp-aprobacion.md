# CxP · Aprobación de facturas de proveedor (match de 2 vías)

Decisión de producto (auditoría v14-2, hallazgo **B-3**, 2026-08-29): el
"three-way match" de CxP es **de 2 vías por diseño**.

## Qué se compara hoy

La aprobación (`_cxp_validar_aprobacion`) contrasta dos fuentes:

1. **La factura del proveedor** (XML/PDF capturado en el buzón o manual).
2. **El costo registrado** en el embarque (conceptos de costo vinculados).

Si la factura excede el costo registrado más allá de la tolerancia, la
aprobación se bloquea.

## Por qué no hay tercera vía (recepciones)

El clásico three-way match agrega un *recibo de mercancía/servicio*. En un
forwarder la "recepción" es el servicio ejecutado sobre el embarque (flete,
maniobras, almacenaje), cuya evidencia vive en el expediente (EIR, tracking,
carta porte) y no como entidad contable separada. Crear un módulo de
recepciones duplicaría captura sin control adicional real.

Si en el futuro se requiere acuse formal de recepción (p. ej. almacenes con
conteo físico), se evaluará como módulo nuevo — queda registrado aquí como
brecha conocida y aceptada.

## Monedas y roles (revisión 2026-09-26)

Comparar documentos/costos después de llevarlos a la moneda correspondiente
con la paridad del flujo. Un folio vinculado no convierte un costo USD en MXN.
No ajustar un pago bancario real para hacer cuadrar una captura.

La captura, aprobación y pago tienen capacidades separadas y reglas SoD.
Ver `src/lib/access/permissionMatrix.finanzas.ts` y las RPCs de aprobación.
Esta decisión no introduce una tercera entidad de recepción.

## Precisión y validación de la captura

Los precios unitarios, IVA e IEPS capturados se normalizan a **2 decimales**
antes de proponer totales y de guardar. Las cantidades conservan hasta
**6 decimales**; una cantidad que redondea a cero es inválida, no una unidad.
La propuesta manual, el cuadre y las filas persistidas usan esa misma
representación. Adoptar los totales sigue siendo una acción explícita.

Antes de insertar una nueva cabecera se verifica el subtotal contra las
líneas normalizadas, aun sin costos de embarque vinculados, con tolerancia
máxima de 0.01 en la moneda del documento. La tolerancia histórica por
cantidad usada al aprobar no debe esconder pérdidas de precisión al capturar.
El XML se revalida después de normalizar; en PDF se conserva la cabecera
importada para revisión y se bloquea el guardado si no cuadra.
Esta regla no repara ni reescribe documentos históricos.

El wizard muestra la categoría pendiente, valida los datos antes de avanzar
al paso 3 y lleva cualquier intento de guardar con campos requeridos
faltantes al paso 2, enfocando el primero. El mismo flujo se aplica al atajo
Ctrl/Cmd + Enter y conserva los datos capturados.

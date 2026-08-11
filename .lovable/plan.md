# Embarque 338: por qué los costos aparecen "sin proveedor"

## Diagnóstico (confirmado con datos)

No fue el operador y no fue una migración de base de datos: es una fuga en el wizard de edición del embarque.

Lo que muestran los datos del expediente ELIMP00338:

- La cotización COT-2026-0139 sí trae proveedor: los dos costos (`Flete Maritimo`, `Cargos Destino`) dicen "Wan Hai Lines" desde el 20/07/2026 y nunca se modificaron.
- Al crear el embarque (22/07/2026) el sistema replica esos costos copiando **solo el nombre del proveedor como texto**; nunca guarda el `proveedor_id` (la cotización tampoco lo tiene, solo texto libre).
- El wizard de edición hidrata el proveedor **únicamente desde `proveedor_id`**, así que al abrir el embarque el campo Proveedor sale vacío, aunque el nombre exista en la base.
- Al guardar, el wizard manda `proveedor_id: null` y `proveedor_nombre: ""`, y la función de guardado escribe ese vacío encima del nombre original. El nombre se pierde.

Prueba cruzada: los 6 expedientes con costos sin proveedor (336, 338, 340, 350, 353, 357) tienen todos al menos una edición registrada en la bitácora. El único expediente replicado que conserva el nombre (341) es justamente el que **nunca** se editó. En el 338 la edición fue el 11/08/2026 (cambio de número de contenedor) y se llevó el proveedor de paso.

Analogía: la cotización trae el proveedor escrito a lápiz (solo texto). El formulario de edición solo sabe leer lo escrito en tinta (el `proveedor_id`), no ve el lápiz, y al guardar borra la hoja y la deja en blanco.

## Qué se va a corregir

1. **Dejar de borrar el nombre al guardar**: si el usuario no cambió el proveedor, el guardado conserva el nombre que ya estaba; solo lo reemplaza cuando realmente se eligió otro proveedor (o cuando se limpia el campo de forma explícita).
2. **Hidratar el proveedor por nombre**: al abrir el wizard, si el costo trae nombre pero no id, se busca al proveedor del catálogo por nombre (incluyendo alias) y se preselecciona; si no hay coincidencia, se muestra el nombre como texto informativo en lugar de un campo vacío.
3. **Replicar la cotización con proveedor real**: al crear el embarque desde cotización, resolver el texto del proveedor contra el catálogo y guardar también `proveedor_id`, para que el vínculo quede firme desde el inicio.
4. **Reparar los datos históricos**: recuperar el proveedor de los costos afectados tomándolo de la cotización de origen (los 6 expedientes: 336, 338, 340, 350, 353, 357), y asignar `proveedor_id` donde el nombre coincida con el catálogo. Sin tocar costos ya pagados ni importes.
5. **Aviso en pantalla**: en la pestaña de Costos, marcar visualmente los conceptos sin proveedor para que se detecten antes de facturar.

## Detalles técnicos

- `src/features/embarques/hooks/useHidratacionEditarEmbarque.ts`: resolver `proveedorId` con fallback por `proveedor_nombre` (normalizado, contra `proveedores` y `proveedor_alias`) y conservar el nombre original en el estado local.
- `src/features/embarques/domain/mappers/embarqueToDb.ts` (`buildConceptosCostoPayload`): dejar de emitir `proveedor_nombre: ""`; omitir la llave cuando no hay cambio y enviar el nombre conservado cuando exista.
- Migración: `actualizar_embarque_completo` debe usar `CASE WHEN cc ? 'proveedor_nombre' THEN ... ELSE proveedor_nombre END` en lugar de `COALESCE(..., proveedor_nombre)`, para que un vacío no sobrescriba silenciosamente.
- Migración: `_crear_embarque_replicar_conceptos` resuelve `proveedor_id` por nombre normalizado y lo inserta junto con `proveedor_nombre` en ambas ramas (BL y prorrateo por contenedor).
- Migración de backfill idempotente: repone `proveedor_nombre` desde `cotizacion_costos.proveedor` (match por `concepto` dentro del mismo embarque) y `proveedor_id` por nombre, solo en `conceptos_costo` vivos con proveedor vacío y `estado_liquidacion <> 'Pagado'`.
- Pruebas: caso de regresión de que editar un embarque sin tocar el proveedor conserva `proveedor_nombre`, y caso de replicación que verifica `proveedor_id` resuelto.
- `CHANGELOG.md` + `APP_VERSION`.

# Captura desde el buzón: vinculación precargada y categoría COGS fija

Sí, hace sentido y es una mejora. Si el documento nació de un embarque, ya sabemos dos cosas: a qué expediente pertenece y que su naturaleza contable es costo directo (COGS). Volver a preguntarlas invita al error. Es como recibir un paquete con la etiqueta ya puesta y aún así pedirle al contador que escriba el destino.

## Qué pasa hoy (verificado)

- El proveedor, la nota y los conceptos sugeridos ya se heredan (v13.507.0).
- Pero la sección "Vincular a costos de embarque" lista **todos** los embarques con costos pendientes del proveedor, sin priorizar ni filtrar el expediente del documento: el contador tiene que buscarlo entre varios grupos.
- La **categoría contable** sigue siendo un selector libre con las tres opciones (COGS, Ventas, Administración) y obligatorio, aun cuando el documento viene de un embarque.
- Cada organización tiene hoy exactamente **una** categoría de tipo `CostoDirectoEmbarque`, así que resolverla automáticamente es determinista.

## Cambio 1 — Vinculación centrada en el expediente del documento

En modo buzón:

- El grupo del expediente del documento se muestra **primero, expandido y destacado** ("Expediente del documento"), con sus conceptos ya marcados (herencia actual).
- Los demás embarques del proveedor se colapsan detrás de un enlace "Ver otros N embarques con costos pendientes" — no desaparecen (a veces una factura cubre varios expedientes), pero dejan de competir por atención.
- Si el expediente del documento no tiene costos pendientes, se muestra el aviso de por qué (ya facturados o sin costo capturado) en lugar de una lista vacía.

## Cambio 2 — Categoría contable fija en COGS

En modo buzón (documento originado en un embarque):

- La categoría se resuelve automáticamente a la categoría de tipo **Costo directo de embarque (COGS)** de la organización y el selector se muestra **bloqueado**, con la leyenda "Costo directo de embarque: el documento nació del expediente ELIMP00xxx".
- Un enlace discreto "Cambiar categoría" la desbloquea para casos raros (p. ej. el proveedor facturó un gasto administrativo por error del operador); al desbloquear, el aviso explica que dejará de contar como costo del embarque.
- Si la organización no tiene una categoría COGS activa, el selector se comporta como hoy y se avisa que falta configurarla en Presupuesto.
- En captura manual todo queda **exactamente como hoy**.

## Detalles técnicos

- `CategoriaPresupuestoLite` gana `tipoContable`; `DialogNuevaFacturaProveedor.tsx` mapea `tipo_contable` desde `usePresupuestoCategorias` (el `select("*")` ya lo trae, no hay cambios de datos ni migraciones).
- Nuevo `useCategoriaCogsBuzon.ts` (hook, ≤200 líneas): resuelve la categoría COGS, la fija una vez por documento sin pisar una elección manual y expone `bloqueada` / `desbloquear()`.
- `FacturaProveedorFormFields.tsx`: la sección de categoría acepta `bloqueada`, `motivo` y `onDesbloquear`; sin bloqueo renderiza igual que hoy.
- `VincularEmbarqueSection.tsx` + `vincularEmbarqueHelpers.ts`: nuevo `ordenarGruposPorExpediente(grupos, embarqueIdPrioritario)` y estado de colapso para "otros embarques"; la lógica de selección, tope y cuadre no cambia.
- Se pasa `entrante.embarqueId` / `expediente` desde `ColumnaDatosFactura` a la sección de vinculación.
- Sin colores hardcodeados: tokens `info`, `warning`, `muted`.
- Tests: resolución de la categoría COGS (con y sin categoría activa, y que no pise elección manual), render bloqueado + desbloqueo, y orden/colapso de grupos con expediente prioritario.
- `CHANGELOG.md` + `APP_VERSION` → 13.510.0.

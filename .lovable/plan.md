# Auditoría final del workflow de facturas de proveedor (buzón CxP)

## Veredicto

El flujo **subir → validar → capturar → vincular costo → aprobar → pagar** ya está a nivel ERP en lo esencial: separación de funciones (operaciones sube, contabilidad captura), estados con actualizaciones atómicas verificadas por conteo de filas, deduplicación por huella de PDF y de XML, desvinculación automática de costos al rechazar o cancelar, y desde las últimas dos versiones herencia de proveedor/nota/conceptos y cotejo de importes.

Faltan seis pulidos para cerrar el círculo. Ninguno es un bug abierto: son huecos de operación diaria.

## Hallazgos y cómo cerrarlos

**1. Corregir un dato mal declarado obliga a volver a subir el archivo**
Hoy proveedor, monto declarado, nota y conceptos sugeridos sólo se escriben al subir. Si el operador se equivoca, la única salida es retirar el documento y subirlo de nuevo.
→ RPC para editar esos campos mientras el documento siga *por capturar*, con bitácora, y un botón "Corregir datos" en el buzón del embarque.

**2. Contabilidad rechaza y el operador no se entera**
El rechazo cambia el estado y guarda el motivo, pero nadie avisa: el operador sólo lo ve si vuelve a entrar a la pestaña del embarque.
→ Notificación interna (la app ya tiene bandeja de notificaciones internas) al usuario que subió el documento, con motivo y enlace al embarque.

**3. Retirar y reactivar sólo existe desde el embarque**
Quien rechaza es contabilidad, pero el botón para reactivar vive en la pestaña del embarque, así que tiene que salirse del buzón.
→ Habilitar retirar/reactivar también en la pestaña "Rechazadas" del buzón CxP, con los mismos permisos y confirmaciones.

**4. Si falla el guardado de los conceptos sugeridos, nadie lo ve**
El documento se sube igual y el registro del error se queda en el log técnico; contabilidad recibe el documento "sin sugerencias" sin explicación.
→ Avisar en pantalla que el documento sí quedó subido pero sin sugerencias, y ofrecer reintentar. Añadir además una restricción de unicidad por documento+concepto para que un reintento no duplique sugerencias.

**5. "Quitar todos" / "Volver a aplicar" no queda en bitácora**
Es la decisión contable más delicada del modal (aceptar o descartar lo que declaró operaciones) y hoy sólo vive en memoria del navegador.
→ Registrar al guardar la factura si las sugerencias se aceptaron completas, parciales o se descartaron.

**6. Un documento sólo puede pertenecer a un embarque**
Una factura de naviera que cubre varios expedientes no se puede declarar en el buzón, y tampoco se puede reasignar de embarque.
→ Fuera de alcance de este pulido: requiere cambio de modelo (documento con varios embarques y prorrateo). Se documenta como siguiente sprint, no se implementa ahora.

## Resoluciones HD (1366×768)

Los dos modales usan el mismo shell, que ya está preparado para pantallas bajas: usa casi todo el alto disponible por debajo de 800 px, con un único área de desplazamiento y encabezado, banda de totales y pie fuera de ella. No hay doble barra de desplazamiento ni recortes.

Dos ajustes de comodidad, no de corte:

- **Capturar factura de proveedor**: entre encabezado con chip de totales, banda de cuadre y pie quedan unos 500 px útiles para dos columnas de formulario. En modo buzón conviene compactar el encabezado y colapsar por defecto las secciones ya heredadas (proveedor, nota) para que el contador vea de un golpe importe, cuadre y conceptos.
- **Subir factura al buzón**: seis secciones apiladas en una sola columna angosta. En pantallas anchas conviene dos columnas (izquierda: archivos y datos del CFDI · derecha: proveedor, monto y conceptos), que es donde se gana el alto de HD.

Se validará con capturas reales a 1366×768 antes de cerrar.

## Pruebas pendientes de las dos últimas versiones

Los archivos nuevos no tienen pruebas propias: herencia de datos del buzón, pre-marcado de conceptos, tarjeta del documento, aviso de monto y banda de sugerencias. Se añaden pruebas unitarias de cada uno como parte de este trabajo.

## Detalles técnicos

- Nueva RPC `actualizar_datos_entrante(p_entrante_id, p_proveedor_id, p_monto_declarado, p_moneda_declarada, p_nota, p_sin_costo_capturado)`: sólo estado `por_capturar`, sin `deleted_at`, mismo tenant, `SECURITY DEFINER` con `search_path=public`, `GRANT EXECUTE` sólo a `authenticated`, verificación por conteo de filas y registro en bitácora.
- RPC de reemplazo de sugerencias `reemplazar_conceptos_entrante(p_entrante_id, p_conceptos jsonb)` atómica (borra + inserta) y `UNIQUE (entrante_id, concepto_costo_id)` en `embarque_facturas_entrantes_conceptos`.
- Notificación de rechazo: insertar en `notificaciones_internas` dentro de `rechazar_factura_entrante`, destinatario `subido_por`.
- Bitácora de sugerencias: al guardar la factura, `registrarActividad` con `aceptadas`/`quitadas` derivadas del hook de pre-marcado.
- UI: `size` y encabezado compacto en `DialogNuevaFacturaProveedor` cuando hay documento del buzón; grid de dos columnas en `SubirFacturaEntranteDialog`; acciones de retiro/reactivación en `CxpBuzonEntrantes` tab Rechazadas.
- Verificación: capturas Playwright a 1366×768 de ambos modales, `bun run lint`, pruebas de arquitectura (límite de 200 líneas) y las nuevas pruebas unitarias.
- Al cerrar: `CHANGELOG.md` + `APP_VERSION` a 13.508.0.

# Buzón CxP: el COGS no siempre queda seleccionado (bug real)

Sí es un bug real, y sí quedó a medias en v13.510.0. El candado de COGS existe, pero la lectura automática del CFDI/PDF lo pisa.

## Qué está pasando (verificado en código)

Es como si pusieras la etiqueta correcta en el paquete y, un segundo después, llegara otra persona y pegara encima la suya.

1. Al abrir "Capturar factura de proveedor" desde el buzón, `useCategoriaCogsBuzon` fija la categoría de tipo `CostoDirectoEmbarque` **una sola vez** y solo si el campo está vacío (`src/features/cxp/hooks/useCategoriaCogsBuzon.ts:49-55`).
2. Enseguida, `useAutocargaEntrante` descarga el XML/PDF y lo manda al parser. El resultado se aplica con `setValues(result.values)`, que **reemplaza todo el formulario** (`useNuevaFacturaProveedorForm.applyParsed.ts:35`), incluyendo `categoriaId: data.ai.categoria_id ?? ""` (`useNuevaFacturaProveedorForm.helpers.ts:143`).
3. El candado ya "gastó" su único disparo (ref `aplicadoPara`), así que no vuelve a poner COGS.

Resultado observado por la persona de captura:
- Si la IA sugirió otra categoría → queda esa (Administración/Ventas) y el selector aparece desbloqueado.
- Si la IA no sugirió nada → queda vacío.
- Si la IA acertó COGS → se ve correcto. De ahí el "a veces sí, a veces no".

## Corrección propuesta

En modo buzón, COGS manda sobre la sugerencia de la IA:

- El candado deja de ser "una sola vez": mientras el contador no lo desbloquee, cualquier reescritura programática (autocarga del XML, PDF con IA, recarga) vuelve a fijar la categoría COGS.
- Se distingue claramente "cambio del sistema" de "elección humana": solo al usar "Cambiar categoría" y elegir a mano se respeta otra categoría; ahí el candado se retira para ese documento.
- El selector se muestra bloqueado con la leyenda actual ("Costo directo de embarque: el documento nació del expediente ELIMPxxxxx").
- Si la organización no tiene categoría COGS activa, se conserva el comportamiento de hoy (selector libre + aviso de configurarla en Presupuesto).
- Captura manual (sin documento del buzón): sin cambios.

## Detalles técnicos

- `useCategoriaCogsBuzon.ts`: reemplazar la ref `aplicadoPara` de un solo disparo por reconciliación continua — efecto que reaplica `cogs.id` cuando `documentoId && cogs && !desbloqueada && categoriaActual !== cogs.id`, con ref `elegidaManualmente` que se activa solo desde `desbloquear()`. Reset al cerrar el diálogo (ya existe).
- Alternativa complementaria (se implementa también, es defensa en profundidad): en modo buzón no propagar `ai.categoria_id` — `useModoBuzonWiring` marca el modo y el candado corrige el valor en cuanto llega.
- Sin migraciones, sin cambios de datos, sin tocar RLS.
- Tests en `src/features/cxp/hooks/__tests__/useCategoriaCogsBuzon.test.tsx`: (a) la categoría vuelve a COGS después de una reescritura tipo autocarga con otra categoría; (b) tras `desbloquear()` + elección manual, ya no se reaplica; (c) sin categoría COGS activa sigue mostrando el aviso.
- `CHANGELOG.md` + `APP_VERSION` → 13.620.0.

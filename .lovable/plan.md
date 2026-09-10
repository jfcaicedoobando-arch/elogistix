# Pulido visual de Tarifas marítimas

## Objetivo
Hacer la pantalla más clara y útil en escritorio HD, priorizando comparación de tarifas sin cambiar cálculos, aprobaciones, filtros ni datos.

## Cambios propuestos

1. **Dar más espacio a la información útil**
   - Compactar ligeramente el encabezado y la franja de indicadores en pantallas de 720 px de alto.
   - Mantener los cuatro indicadores, sus colores semánticos y su comportamiento de filtro.
   - Subir la tabla en el primer viewport para mostrar más filas sin perder jerarquía.

2. **Unificar filtros y controles de vista**
   - Ordenar búsqueda, filtros, contador y selector Agrupada/Tabla como una sola barra visual.
   - Conservar los filtros activos removibles, mostrándolos en una segunda línea sólo cuando existan.
   - Mantener etiquetas y foco de teclado claros.

3. **Rediseñar la distribución de la tabla para 1280×720**
   - Integrar el tipo de contenedor como dato secundario de Ruta, eliminando una columna independiente en ese ancho.
   - Mantener Agente/Naviera, Total USD, Vigencia, Estado y Acciones legibles en el primer viewport.
   - Mostrar Flete y Recargos únicamente en pantallas muy amplias, porque Total USD ya los resume.
   - Conservar Ruta fija a la izquierda y Acciones fija a la derecha sin superponer columnas.
   - Mantener la pista y los degradados de desplazamiento horizontal cuando realmente exista overflow.

4. **Mejorar jerarquía dentro de cada fila**
   - Destacar únicamente el mejor total con verde semántico; dejar los demás importes con contraste neutral.
   - Presentar vigencia como fecha principal y urgencia/vencimiento como texto secundario.
   - Reservar un ancho estable para Estado y acciones rápidas, incluyendo filas Pendientes.
   - Evitar cortes de nombres y montos mediante anchos semánticos y truncado sólo en textos secundarios.

5. **Pulir la vista Agrupada sin cambiar su función**
   - Reducir ruido en encabezados de ruta y alinear mejor promedio, diferencia y mejor tarifa.
   - Mantener expandir/colapsar, acciones y comparación existentes.
   - Aplicar la misma jerarquía visual de precio, vigencia y estado que en la tabla.

6. **Validación y entrega**
   - Agregar o actualizar regresiones focalizadas de estructura, accesibilidad y columnas visibles.
   - Verificar visualmente a 1280×720 con sidebar expandido y colapsado, en vista Tabla y Agrupada, incluyendo una fila Vigente y una Pendiente.
   - Comprobar teclado/foco, tema claro y adaptación móvil.
   - Actualizar versión patch, CHANGELOG y manifiesto; no publicar.

## Límites
- Sin cambios de cálculos, reglas de vigencia, aprobación, permisos, datos o backend.
- Sin dependencias, vistas nuevas ni reestructura del router.
- Las suites globales de CI, RLS, Vitest y E2E quedan para GitHub Actions.

## Resultado esperado
Una pantalla menos comprimida, con mayor cantidad de filas visibles y una lectura inmediata de ruta, costo total, vigencia, estado y acciones en escritorio HD.

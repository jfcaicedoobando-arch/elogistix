## Plan de corrección

El problema no es sólo el texto del encabezado: la lista de `/embarques` está aplicando el filtro de estado después de pedir una página al backend. Por eso el dashboard puede contar 4 contenedores en Arribo, pero la tabla sólo revisa los primeros 10/20 registros recibidos y termina mostrando 1 o incluso 0 al cambiar a `10 / pág`.

### Cambios propuestos

1. **Corregir la fuente de datos del listado cuando hay filtro de estado**
   - Hacer que el filtro `estado=Arribo` se aplique sobre el conjunto completo de embarques que cumplen los demás filtros, no sólo sobre la página actual.
   - Usar la misma regla de estado calculado que el dashboard: `Confirmado`, `En Tránsito`, `Arribo`, etc.
   - Después de filtrar por estado, agrupar por expediente para que la tabla siga mostrando una fila por expediente.

2. **Separar correctamente conteos de contenedores y expedientes**
   - `contenedoresCount`: total real de contenedores en ese estado.
   - `expedientesCount`: total real de expedientes agrupados.
   - Para tu caso esperado: si el dashboard dice 4 contenedores en Arribo y todos pertenecen al mismo expediente, `/embarques?estado=Arribo` debe decir: `4 contenedores en 1 expediente`.

3. **Arreglar el bug de `10 / pág`**
   - La paginación debe ocurrir después de filtrar y agrupar, no antes.
   - Cambiar de `20 / pág` a `10 / pág` no debe hacer desaparecer el expediente.
   - `totalPages` debe calcularse con los expedientes filtrados, no con registros sin filtrar.

4. **Mantener navegación del dashboard**
   - Los iconos del dashboard seguirán navegando a `/embarques?estado=<estado>`.
   - No cambiaré los cálculos del dashboard; el dashboard ya está contando contenedores correctamente.

5. **Actualizar versión y changelog**
   - Subir versión patch.
   - Registrar el cambio al inicio del changelog según la convención del proyecto.

### Archivos a tocar

- `src/hooks/embarque/useEmbarquesPageState.ts`
- `src/hooks/embarque/useEmbarqueQueries.ts`
- `src/services/embarque/queries/listado.ts`
- `src/pages/embarques/Embarques.tsx` si hace falta ajustar el texto final
- Archivos de versión/changelog del proyecto

### Resultado esperado

Con la URL `/embarques?estado=Arribo&ps=10`, la tabla debe seguir mostrando el expediente correspondiente y el encabezado debe cuadrar con el dashboard: `4 contenedores en 1 expediente`.
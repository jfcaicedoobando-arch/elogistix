# País y puerto dependientes en la solicitud de pricing

## Qué vas a ver

En el formulario **Nueva solicitud de pricing** (sección Ruta):

- **Origen** pasa a llamarse **País de Origen** y **Destino** pasa a **País de Destino**. Ambos siguen siendo obligatorios, pero ahora se eligen de una lista de países (los países que ya tienen puertos dados de alta en el catálogo), en lugar de escribirse a mano.
- Dos campos nuevos, **opcionales**: **Puerto origen** y **Puerto destino**. Son buscadores con los puertos que ya tenemos guardados en el sistema.
- Los puertos se filtran según el país elegido: si País de Origen es China, Puerto origen solo muestra puertos de China; si País de Destino es México, Puerto destino solo muestra puertos de México. Es como elegir primero el estado y después la ciudad.
- Si cambias el país después de haber elegido un puerto de otro país, el puerto se limpia para no guardar combinaciones imposibles.
- Puerto origen y Puerto destino no pueden ser el mismo puerto.

## Dónde se guarda

- País de Origen / País de Destino se guardan en las columnas existentes `origen` / `destino` (sin cambios en la base de datos).
- Puerto origen / Puerto destino se guardan en las columnas existentes `pol` / `pod` (AOL/POL y AOD/POD), que hoy son texto libre y pasan a ser el buscador de puertos. El detalle de la solicitud y la bandeja ya muestran esas columnas, así que se ven sin tocar nada más.
- **No se crean migraciones ni columnas nuevas.**

## Detalles técnicos

- `SolicitudPricingCampos.tsx`: la sección Ruta cambia a: País de Origen (lista obligatoria), Puerto origen (PortIdSelect filtrado por país), País de Destino (lista obligatoria), Puerto destino (ídem), Fecha tentativa de carga, Delivery. El campo AOL/POD deja de existir como texto libre.
- Los países se derivan del catálogo `usePuertos()` (distinct de `country`, ordenado en español). Reutiliza `PortIdSelect` de `@/features/catalogos` con la lista ya filtrada por país y `excludeId` para evitar origen = destino.
- Al elegir un puerto se guarda su etiqueta (`Nombre, País (CÓDIGO)`) como texto en `pol`/`pod`, para no inventar columnas ni romper solicitudes históricas con texto libre.
- Al cambiar de país, si el puerto elegido no pertenece al nuevo país, se limpia.
- `solicitudCompleta()` ya valida origen/destino; no cambia. El botón Guardar/Enviar sigue bloqueado hasta tener ambos países.
- Archivos ≤200 líneas: la lógica de filtrado país→puerto va en un helper puro nuevo (`puertosPorPais.ts`) con sus pruebas.

## Validación

- Pruebas focalizadas del helper (filtrado por país, limpieza al cambiar país, exclusión origen/destino) y del formulario.
- Typecheck focalizado. CI/RLS completos quedan pendientes de GitHub Actions.

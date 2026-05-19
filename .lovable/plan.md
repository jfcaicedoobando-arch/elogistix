## Problema

En `ELIMP00216 → Editar`, los selects **Shipper (Exportador)** y **Consignatario** salen vacíos aunque el embarque ya tiene datos guardados.

**Causa raíz:** en la BD `embarques.shipper` y `embarques.consignatario` se guardan como **string con el nombre resuelto** (ej. `"HEBEI LONGDA... — Proveedor (CHINA)"` o `"INDIMEX TRADING"` para "mismo cliente"), pero los `<Select>` del wizard esperan como `value` un **`contacto.id`**, `"__cliente__"` o `"__otro__"`. El mapper `mapEmbarqueRowToFormValues` copia el string crudo, que no coincide con ningún `SelectItem`, así que el control se ve vacío.

## Solución (solo frontend)

Agregar una resolución inversa una sola vez, después de que carguen los contactos del cliente y el embarque, en `useEditarEmbarqueWizard.ts`:

1. Nueva utilidad `resolverValorContactoDesdeTexto(stored, contactos, clienteNombre, opciones)` en `src/lib/contacto/index.ts`:
   - Si `stored` está vacío → devolver `{ value: '', manual: '' }`.
   - Si `opciones.permitirCliente` y `stored === clienteNombre` → `{ value: '__cliente__', manual: '' }`.
   - Buscar contacto donde `${nombre} — ${tipo} (${pais}) === stored` (o como fallback, `nombre === stored`) → `{ value: contacto.id, manual: '' }`.
   - En cualquier otro caso → `{ value: '__otro__', manual: stored }`.

2. En `useEditarEmbarqueWizard`, nuevo `useEffect` con guard `hidratoContactos` (state) que dispara cuando `initialized && contactos.length >= 0 && embarque` y resuelve:
   - `shipper`/`shipperManual` con `permitirCliente: false`.
   - `consignatario`/`consignatarioManual` con `permitirCliente: true` usando `selectedCliente?.nombre`.
   - Usar `methods.setValue(campo, valor, { shouldDirty: false })` para no marcar el form como modificado.
   - Marcar `hidratoContactos = true` y no volver a correr.

3. Test unitario para `resolverValorContactoDesdeTexto` en `src/lib/contacto/__tests__/` cubriendo los 4 casos (vacío, cliente, contacto match, otro).

## Verificación

- Entrar a `/embarques/30525762-…/editar` y confirmar que Shipper muestra "HEBEI LONGDA… — Proveedor (CHINA)" y Consignatario muestra "Mismo cliente (INDIMEX TRADING)".
- Probar con un embarque cuyo shipper sea texto libre (caer en "Otro" con el manual prellenado).
- Guardar sin tocar nada y verificar que `cambiosEmbarque` (diff) no reporta cambios en `shipper`/`consignatario`.

## Changelog

Bump a **8.224.0** con entrada "Editar embarque: precargar Shipper y Consignatario con los valores ya guardados."
## Problema

En el wizard de crear/editar embarque, los selects **Shipper (Exportador)** y **Consignatario** muestran la lista completa de `contactos_cliente` del cliente, incluidos los contactos marcados como **Proveedor**. Un "Proveedor" en `contactos_cliente` (enum `tipo_contacto`: `Proveedor | Exportador | Importador`) es un proveedor del cliente en su cadena de suministro y **no** debe aparecer como consignatario ni como shipper de un embarque.

Nota: esto no es la tabla `proveedores` (nuestros proveedores logísticos). Son contactos del cliente clasificados con `tipo = 'Proveedor'`.

## Cambio propuesto

Filtrar la lista de contactos que se pasa a cada `Select` en `src/features/embarques/components/secciones/BloqueClienteContactos.tsx`:

- **Shipper**: mostrar sólo contactos con `tipo === 'Exportador'`.
- **Consignatario**: mostrar sólo contactos con `tipo === 'Importador'`, conservando las opciones especiales `"Mismo cliente (…)"` y `"Otro (escribir manualmente)"`.

Si la lista filtrada queda vacía, mostrar un `SelectItem` deshabilitado con el texto "Sin contactos de este tipo — usa 'Otro'" para dar contexto al usuario y evitar un dropdown en blanco.

No se cambia el modelo de datos, ni el mapper `embarqueToDb/FromDb`, ni la hidratación: si un embarque legacy ya tiene guardado el id de un contacto tipo "Proveedor" como shipper/consignatario, `resolverValorContactoDesdeTexto` lo seguirá resolviendo (se busca por id, no por tipo). Sólo restringimos qué se ofrece al elegir de nuevo.

## Archivos a tocar

- `src/features/embarques/components/secciones/BloqueClienteContactos.tsx` — dos `.filter(...)` sobre `contactos` antes de mapear a `SelectItem`, más el fallback vacío.
- `src/constants/appVersion.ts` — bump patch a `13.303.27`.
- `CHANGELOG.md` — entrada breve.

## Fuera de alcance

- No se toca el CRUD de contactos ni el enum en BD.
- No se filtran otros consumidores de `useContactosCliente` (portal, CRM, envíos de documentos): ese cambio requeriría análisis aparte por cada caso de uso.
- No se migran embarques legacy con consignatario "Proveedor" ya guardado.

## Analogía

Es como el formulario de una boda: en "novio" y "novia" no deberían aparecer los invitados. Antes el sistema listaba a toda la agenda del cliente; ahora sólo mostramos exportadores en Shipper e importadores en Consignatario.

## Diagnóstico

En `/cotizaciones/.../enviar`, el `DestinatariosPicker` consulta `contactos_cliente` filtrando por `cliente_id`. Para el cliente **INDIMEX TRADING** (y en general en la base) los únicos contactos guardados son `tipo = "Proveedor"` o `"Exportador"` (22 + 1 en toda la BD). Esos son los **shippers de origen** (fábricas chinas), no los contactos del importador a quien se le debe enviar la cotización.

Además, `clientes.email` (ej. `erika@indimextrading.com`) tiene el correo principal del cliente y hoy **no aparece** en el picker.

## Fix propuesto

### 1. Incluir el email principal del cliente como destinatario sintético
- En `fetchContactosClienteConEmail` (o en el hook `useEnvioCotizacionForm`), traer también `clientes.email` y `clientes.nombre`.
- Inyectarlo al inicio de la lista como un pseudo-contacto con `id = "cliente-principal"`, `tipo = "Cliente"`, marcado y resaltado.

### 2. Separar visualmente shippers/proveedores
- En `DestinatariosPicker`, partir la lista en dos grupos:
  - **Contactos del cliente** (tipos: `Cliente`, `Cotización`, `Operativo`, `Cobranza`, `Administrativo`, sin tipo, etc.) — visibles y ordenados primero.
  - **Proveedores / Shippers (origen)** (tipos: `Proveedor`, `Exportador`) — dentro de un `<details>` colapsado con leyenda "Mostrar shippers de origen (no recomendado para cotización)".
- Badge del tipo con color distinto (warning) para los proveedores, para que sea obvio si alguien los selecciona.

### 3. Pre-selección segura
- Cambiar la lógica del `useEffect` de pre-selección:
  1. Email principal del cliente (si existe y es válido).
  2. Si no, primer contacto cuyo `tipo` matchee `/(cotiz|operativ|administ|cliente)/i`.
  3. Si no, **ninguno** (forzar al usuario a elegir; mejor que mandar al shipper por accidente).
- Nunca pre-seleccionar contactos con tipo `Proveedor` / `Exportador`.

### 4. Empty state
- Si tras filtrar no queda ningún contacto cliente y el cliente no tiene `email`, mostrar el mensaje actual + un link a "Agregar contacto" en la ficha del cliente.

## Verificación

1. Abrir `/cotizaciones/b75f1f9a-...` (INDIMEX TRADING) → "Enviar cotización": ver `erika@indimextrading.com` marcado por defecto y los 7 proveedores chinos ocultos bajo el `<details>`.
2. Cliente sin `email` y sólo contactos `Proveedor`: lista principal vacía, nada pre-seleccionado, shippers disponibles bajo el desplegable.
3. Cliente con contactos `Cotización`: ese contacto queda pre-seleccionado en vez del email principal.
4. Test de `useEnvioCotizacionForm`: cubrir las 3 ramas de pre-selección.

## Archivos a tocar

- `src/features/cotizacion/services/envios.ts` — extender `fetchContactosClienteConEmail` para devolver también el email principal del cliente (o un nuevo `fetchDestinatariosCliente`).
- `src/features/cotizacion/hooks/useEnvioCotizacionForm.ts` — nueva lógica de pre-selección y tipo de "Cliente".
- `src/features/cotizacion/components/detalle/DestinatariosPicker.tsx` — agrupar y colapsar proveedores.
- `CHANGELOG.md` + `src/constants/appVersion.ts` → `13.66.5`.

## Notas

- No se modifica el esquema; los contactos tipo `Proveedor` siguen existiendo en `contactos_cliente` y son visibles en la ficha de cliente.
- La separación es UI-only en el flujo de envío de cotización (no afecta otras pantallas que consumen `contactos_cliente`).

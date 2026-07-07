
# Mejora al modal "Enviar factura por correo"

Dos cambios pedidos, ambos con impacto en piezas compartidas:

## 1. Quitar la sección de correos de proveedores/shippers

Hoy `DestinatariosPicker` (compartido por factura, cotización y proforma) muestra un bloque colapsable **"Mostrar proveedores / shippers (N) — no recomendado"**. El usuario quiere que ese bloque desaparezca por completo — nunca se debe mandar factura a un shipper.

Cambio:
- `src/components/shared/emails/DestinatariosPicker.tsx`: eliminar el `<details>` de `proveedorContactos` y el filtro visual. La lista sólo muestra `clienteContactos` (con `esContactoProveedor === false`). Los contactos tipo proveedor/shipper quedan ocultos siempre.
- Ajustar `__tests__/DestinatariosPicker.test.tsx` para reflejar el borrado (si tiene aserciones sobre el bloque).

Alcance colateral: cotización y proforma también dejan de ver ese bloque. Consistente con la lógica de negocio (no mandarle factura/cotización al proveedor del cliente).

## 2. Recordar destinatarios manuales y CC entre envíos al mismo cliente

Hoy el modal ya recuerda **CC** por cliente (`clientes.email_cc_default` + fallback al último `factura_envios.cc`). Falta hacer lo mismo con los **destinatarios manuales** (emails escritos a mano que no vienen de la ficha del cliente).

### Backend

- Nueva migración:
  - `ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email_destinatarios_default text[];`
  - Actualizar `obtener_defaults_facturacion_cliente(uuid)` para devolver también `destinatarios_emails text[]`, con COALESCE:
    - preferencia guardada en `clientes.email_destinatarios_default`, o
    - último `factura_envios.destinatarios` (extrayendo sólo los emails que NO estén en `contactos_cliente.email` del mismo cliente — así no duplicamos los del checkbox).

### Servicios

- `src/features/facturacion/services/datosFiscalesCliente.ts`:
  - Añadir `destinatarios_emails: string[] | null` en `DefaultsFacturacionCliente`.
  - Nueva función `guardarDefaultsDestinatariosCliente(clienteId, emails)` → `UPDATE clientes SET email_destinatarios_default = $2`.
  - Reexport en `services/index.ts`.

### Hook compartido

- `src/hooks/emails/useEnvioDocumentoForm.ts`:
  - Nuevo prop opcional `destinatariosManualesInicial?: string[] | null`.
  - En el `useEffect` de apertura, en vez de `setEmailsManualesAgregados([])`, precargar con la lista filtrada (regex email + dedupe contra los emails de los contactos ya listados, para no duplicar).

- `src/components/shared/emails/EnviarDocumentoDialog.tsx`:
  - Nuevo prop opcional `destinatariosInicial?: string[] | null` reenviado al hook.

### Wiring del modal de factura

- `src/features/facturacion/components/DialogEnviarFacturaBranded.tsx`:
  - Pasar `destinatariosInicial={defaults?.destinatarios_emails ?? null}`.
  - En `onEnviar` (además del guardado de CC ya existente): calcular `manualesPersist = payload.destinatarios.filter(d => !d.contacto_id).map(d => d.email)` y llamar `guardarDefaultsDestinatariosCliente(factura.cliente_id, manualesPersist)` con `try/catch` best-effort.

### Tests

- Extender `DialogEnviarFacturaBranded` (si tiene test) o el test del hook `useEnvioDocumentoForm`:
  - Que `destinatariosManualesInicial` precarga los badges y no duplica con contactos.
  - Que al vaciar la lista y enviar, se persiste `[]` (para "olvidar" preferencias explícitamente).
- `guardarDefaultsDestinatariosCliente`: test mínimo del service (mock supabase).

### Metadata

- `APP_VERSION` → `13.213.41`.
- Nueva entrada `## [13.213.41] - 2026-07-07` en `CHANGELOG.md` explicando ambos cambios con analogía breve (agenda de correos que se acuerda de los invitados frecuentes; sacar los mails de los proveedores del picker porque no son destinatarios válidos de una factura al cliente).

## Fuera de alcance

- Persistir destinatarios manuales para cotización/proforma (mismo patrón, pero requiere cuatro cambios adicionales por módulo). Se puede hacer en otra ola si el usuario lo pide.
- No se elimina el helper `esContactoProveedor` — sigue usándose para filtrar la lista, sólo desaparece de la UI el bloque expandible.

## Archivos

Nuevos:
- `supabase/migrations/<timestamp>_defaults_destinatarios_cliente.sql`

Editados:
- `src/components/shared/emails/DestinatariosPicker.tsx`
- `src/components/shared/emails/__tests__/DestinatariosPicker.test.tsx` (si aplica)
- `src/hooks/emails/useEnvioDocumentoForm.ts`
- `src/components/shared/emails/EnviarDocumentoDialog.tsx`
- `src/features/facturacion/services/datosFiscalesCliente.ts`
- `src/features/facturacion/services/index.ts`
- `src/features/facturacion/components/DialogEnviarFacturaBranded.tsx`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`

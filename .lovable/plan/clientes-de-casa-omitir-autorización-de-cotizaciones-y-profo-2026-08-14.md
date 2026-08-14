# Clientes "de casa": omitir autorización de cotizaciones y proformas

## Opinión

Sí, es buena idea y es una práctica común en forwarders: los clientes de casa (cuenta recurrente, tarifa ya pactada) no firman cada cotización ni cada proforma, y hoy el sistema los obliga a pasar por el mismo circuito que un prospecto nuevo. Tres condiciones para que no se vuelva un hueco de control:

1. La bandera vive en el **perfil del cliente**, no en el documento: se decide una vez, con dueño y fecha.
2. **No elimina la aprobación interna ni la segregación de funciones (SoD).** Se omite la autorización *del cliente*, no el visto bueno interno. Quien captura sigue sin poder auto-aprobar.
3. Todo queda **sellado en bitácora y en el timeline** del documento: "Autorización del cliente omitida por configuración del perfil", con el usuario y la fecha en que se activó la bandera.

Solo un rol de administración/gerencia comercial debe poder prender o apagar la bandera.

## Qué se construye

### 1. Perfil del cliente
Dos interruptores nuevos en la ficha del cliente (pestaña de condiciones comerciales), ambos encendidos por omisión para no cambiar el comportamiento de los clientes actuales:

- **Requiere autorización del cliente en cotizaciones**
- **Requiere autorización del cliente en proformas**

Al apagarlos se muestra una advertencia clara de lo que implica y se registra el cambio en la bitácora. Solo editable por `admin`, `admin_org`, `super_admin` y `gerente_comercial`.

### 2. Cotizaciones
Cuando el cliente no requiere autorización:

- El detalle muestra una franja informativa: "Cliente de casa: no requiere autorización. Puedes aprobarla internamente."
- El botón "Enviar al cliente" deja de ser un paso obligatorio previo: la aprobación interna puede hacerse desde Borrador (hoy aceptar exige estado "Enviada").
- La aprobación queda marcada como interna en el timeline, con el motivo.
- Se conserva el bloqueo de SoD (el autor no se aprueba a sí mismo) y el de importes en cero.
- Los clientes que sí requieren autorización no cambian en nada.

### 3. Proformas
Cuando el cliente no requiere autorización:

- Al aprobarse internamente, la proforma pasa automáticamente a "aceptada por el cliente" con sello de origen automático (no queda pendiente esperando respuesta del portal).
- Con eso entra sola a la bandeja "Listas para facturar" y pasa el candado de facturación existente.
- El timeline muestra "Aceptación automática (cliente sin autorización requerida)" en lugar de una firma del portal.
- Deja de enviarse el correo de solicitud de autorización; se puede seguir enviando la proforma como informativa.

### 4. Visibilidad
- Distintivo "Cliente de casa" junto al nombre del cliente en el detalle de cotización y de proforma.
- Filtro en el listado de clientes para ver quiénes tienen la autorización relajada.

## Detalles técnicos

**Base de datos (una migración):**
- `public.clientes`: agregar `requiere_autorizacion_cotizacion boolean NOT NULL DEFAULT true` y `requiere_autorizacion_proforma boolean NOT NULL DEFAULT true`.
- Nueva función `public.cliente_requiere_autorizacion(p_cliente_id uuid, p_tipo text) RETURNS boolean` (`STABLE`, `SECURITY DEFINER`, `search_path=public`) para consultar la bandera desde triggers y RPCs sin depender de RLS del llamante.
- `aceptar_cotizacion_version`: si el cliente no requiere autorización, permitir el estado actual `Borrador` además de `Enviada`, y anotar `origen_aceptacion='interna_cliente_de_casa'` en el detalle de bitácora. Sin cambio para el resto.
- `actualizar_estado_cliente_proforma` / flujo de aprobación interna de proforma: nueva RPC `aceptar_proforma_sin_autorizacion(p_proforma_id uuid)` que valida la bandera del cliente, fija `estado_cliente='aceptada'`, `aceptada_at=now()`, `aceptada_por='auto:sin_autorizacion_requerida'` y escribe bitácora. El trigger `enforce_proforma_aceptada_before_factura` se mantiene intacto: se cumple porque la proforma ya queda aceptada.
- `_cotizaciones_bloquear_auto_aceptacion` y `_cotizaciones_bloquear_envio_sin_importes` no se tocan.
- Sin nuevas tablas, por lo que no hay GRANT nuevos; `EXECUTE` de las funciones nuevas solo a `authenticated` (revocado a `anon`, whitelist FIX-45).

**Frontend:**
- `src/features/cliente/**`: campos nuevos en el formulario/ficha de condiciones comerciales, con gate de rol vía `usePermissions`.
- `src/features/cotizacion/domain/cotizacion.acciones.ts`: `accionesCotizacionPermitidas` recibe `requiereAutorizacionCliente` y habilita `aceptar` en `Borrador` cuando es `false`; pruebas unitarias de los cuatro casos.
- `src/features/proformas/**`: botón de aprobación interna que llama a la RPC nueva, textos del timeline (`proformaClienteEstado.ts`) y supresión del envío de solicitud de autorización.
- Nuevo componente compartido `BadgeClienteDeCasa` para los encabezados de cotización y proforma.
- Invalidación de query keys de clientes, cotizaciones y proformas ya centralizadas.

**Registro:** entrada en `CHANGELOG.md` y bump de `APP_VERSION` a `13.624.0`.

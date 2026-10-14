# Envío final de solicitudes a Pricing, avisos y etiqueta «Solicitud respondida»

## Qué cambia para el usuario

1. **Primero revisas el tarifario y después envías**
   - En el formulario de «Nueva solicitud», el botón «Enviar a Pricing» cambia a **«Revisar tarifario»**. Guarda la solicitud como borrador (todavía no le llega a nadie) y abre su detalle.
   - En el detalle aparecen las tarifas del tarifario que coinciden, como hoy. Si una te sirve, usas «Usar esta opción» y ya no hace falta mandarla.
   - Si ninguna te sirve, abajo de las opciones aparece el botón final **«Enviar a Pricing»** con el texto «Revisé el tarifario y ninguna opción me sirve». Hasta ese momento se envía la solicitud y empieza a correr el reloj.
   - «Copiar y enviar» sigue igual (la copia ya se revisó antes).

2. **Aviso a los responsables al enviar**
   - Cuando la solicitud se envía, les llega una notificación (la campana de arriba) a los usuarios de Pricing de la empresa: ejecutivo de pricing y gerente de operaciones. Al tocarla se abre la solicitud.
   - Los borradores no avisan a nadie.

3. **Aviso al solicitante cuando se responde**
   - Cuando Pricing marca la solicitud como respondida, al solicitante (y a quien la creó, si es otra persona) le llega la notificación «Tu solicitud OCT26xxxx fue respondida», con enlace a la oportunidad.
   - Si se responde eligiendo una opción del tarifario, no se manda aviso, porque fue el mismo solicitante quien la eligió.

4. **Etiqueta «Solicitud respondida»**
   - En la tarjeta del Kanban y en el título de la oportunidad (junto a la etapa) aparece una etiqueta verde «Solicitud respondida» cuando la oportunidad tiene al menos una solicitud respondida y ninguna pendiente. Si hay una enviada esperando respuesta, no aparece.

## Qué no cambia
- Folios, plazos, permisos de quién responde o cancela y las solicitudes que ya existen.
- No se envían correos; solo avisos dentro de la app.

## Detalles técnicos
- `SolicitudPricingDialog.tsx`: el submit guarda con `enviar: false` y navega/abre el detalle; quitar el texto «avisa a Pricing».
- Nuevo componente pequeño `EnviarSolicitudFinal.tsx` en el detalle, visible solo si `estado === "borrador"` y el usuario es autor o Pricing; usa `useAccionSolicitud` con `accion: "enviar"`.
- Avisos en la base (atómicos con el cambio de estado, no desde la pantalla): migración que actualiza `crm_enviar_solicitud_pricing` y `crm_responder_solicitud_pricing` para insertar en `crm_notificaciones` (misma organización; destinatarios por `user_roles` con rol de Pricing, o `solicitante_id`/`created_by`), sin duplicar si se repite la llamada. `crm_aplicar_tarifa_tarifario` no notifica.
- Etiqueta: servicio que consulta en lote las solicitudes no borradas por `oportunidad_id` del Kanban (una sola consulta, como la de empresa eliminada) y componente `EtiquetaSolicitudRespondida.tsx` usado en `OportunidadCard.tsx` y `OportunidadDetalleContent.tsx`.
- Pruebas: regla de la etiqueta (respondida sí / con enviada pendiente no / cancelada sola no) y visibilidad del botón final. Validación focalizada; CI/RLS completos en GitHub Actions. Sin cambio de versión ni CHANGELOG.

# Fase 5 — Solicitud a Pricing dentro de la oportunidad

## Qué vas a ver
- En la ficha de cada oportunidad, una pestaña **Pricing** con el botón **Nueva solicitud**.
- La solicitud trae folio automático consecutivo (**SEP0081**, SEP0082…), con los campos de tu formato de Sheets: Solicitante (lista de usuarios), Fecha, Cliente, Service, IMO, Commodity, Container Size, Type, Quantity, Estibable, Weight, Dimensions, Incoterm (9 opciones), AOL/POL, AOD/POD, Origen, Destino, Fecha tentativa de carga, Delivery, Notas importantes y **Complejidad** (Baja/Media/Alta).
- Al enviarla, a Juan Luis y a quien tenga el rol de Pricing les llega un aviso en la campanita con liga a la solicitud.
- Una bandeja **CRM → Pricing** para Pricing: lista de solicitudes con folio, cliente, solicitante y un **reloj** que se pone en amarillo cuando queda poco tiempo y en rojo cuando se vence (Baja 8 h, Media 24 h, Alta 48 h).
- Pricing contesta con **una o varias opciones**. Cada opción lleva: Agente, Carrier (navieras del sistema), Carta garantía (Sí/No), Tiempo de tránsito, Ruta y 4 cargos con Tarifa + Moneda + Unidad (OF, Cargos en origen, Recolección, Otros con especificación). Botón **Agregar opción**. Una opción puede llenarse desde el catálogo de tarifas de Costeo (se copian los datos) o capturarse a mano.
- Al marcar **Respondida**, el reloj se detiene, queda el tiempo real de respuesta y el solicitante recibe aviso.

## Estados
Borrador → Enviada → Respondida (o Cancelada). Una solicitud enviada ya no se edita por el solicitante; Pricing puede seguir agregando opciones hasta marcarla respondida.

## Fuera de alcance (YAGNI)
- No genera cotización automáticamente a partir de una opción (se puede pedir después).
- Sin correos; solo aviso dentro de la plataforma.

## Detalles técnicos
- Migración: `crm_solicitudes_pricing` (organization_id, oportunidad_id, folio único por org, solicitante_id, campos del formato, complejidad, estado, enviada_at, vence_at, respondida_at, timestamps, soft-delete) y `crm_pricing_opciones` (solicitud_id, organization_id, tarifa_id opcional, agente, naviera_id, carta_garantia, transito, ruta, 4 grupos tarifa/moneda/unidad, otros_concepto, orden).
- Folio con `folio_secuencias` existente, sembrado para Elogistix en 80 para que la primera sea SEP0081; trigger BD que lo asigna e impide cambiarlo.
- RPCs atómicas: `crm_enviar_solicitud_pricing` (fija vence_at según complejidad, notifica a `ejecutivo_pricing` vía `notificaciones_internas`) y `crm_responder_solicitud_pricing` (exige ≥1 opción, notifica al solicitante). Idempotentes por estado.
- RLS por organization_id; opciones solo las escriben ejecutivo_pricing/admin_org/super_admin; GRANT en ambas tablas.
- Frontend: `services/pricingCrm.ts`, hooks, `SolicitudPricingDialog` (FormDialogShell), `OpcionPricingForm`, `RelojPricing`, ruta `/crm/pricing`; archivos ≤200 líneas, pruebas focalizadas, db:postcheck.

# Flujo de cotización + Handover alineado al documento

Mucho ya existe (oportunidad → solicitud de pricing → coincidencias del tarifario → respuesta con opciones → "Cotizar con esta opción" → cotización con margen mínimo → copia controlada). El plan cierra las brechas, en fases pequeñas y entregables por separado.

## 1. Tabla de formatos completada (orden único para los 4 formularios)

Todos los formularios usarán este mismo orden de secciones: **Quién → Qué carga → Ruta → Tarifa/Tiempos → Notas**. "→" indica que el dato viaja automáticamente al siguiente formulario.

| # | Solicitud de Pricing | Respuesta de Pricing (opción) | Tarifa nueva (tarifario) | Cotización | Viaja |
|---|---|---|---|---|---|
| **Quién** | | | | | |
| 1 | Solicitante | Respondido por | Creado por | Comercial | Solicitante → Comercial |
| 2 | Fecha | Fecha de respuesta | Vigente desde | Vigencia desde | — |
| 3 | Cliente / Prospecto (de la oportunidad) | — | Cliente (solo especiales) | Destinatario (cliente o prospecto) | → |
| **Qué carga** | | | | | |
| 4 | Modo de transporte | — | (marítimo) | Modo de transporte | → |
| 5 | **Tipo de operación (nuevo)** Imp/Exp | — | — | Tipo de operación | → |
| 6 | Incoterm | — | — | Incoterm | → |
| 7 | IMO (carga peligrosa) | — | — | Tipo de carga (IMO = Peligrosa) | → |
| 8 | **Sector económico (nuevo)** | — | — | Sector económico | → (y desde la oportunidad) |
| 9 | Commodity | — | — | Descripción de la mercancía | → |
| 10 | Tipo de contenedor | Tipo de contenedor | Tipo de contenedor | Tipo de contenedor | → en los tres |
| 11 | Cantidad | — | — | Núm. contenedores (FCL) / Piezas (LCL) | → |
| 12 | Estibable | — | — | Descripción adicional ("No estibable") | → |
| 13 | Peso + Unidad de medida | — | — | Peso (convertido a kg) | → |
| 14 | Dimensiones | — | — | Dimensiones LCL / Volumen | → |
| **Ruta** | | | | | |
| 15 | País/Puerto de origen (POL) | Ruta | Ruta (origen) | Origen + puerto origen | → |
| 16 | País/Puerto de destino (POD) | Ruta | Ruta (destino) | Destino + puerto destino | → |
| 17 | Delivery | Recolección/Otros | — | Tipo de movimiento (Puerta/Puerto) | Delivery → Tipo de movimiento |
| **Tarifa y tiempos** | | | | | |
| 18 | Fecha tentativa de carga | — | — | (se muestra como referencia) | → solo lectura |
| 19 | — | Agente / Naviera | Agente / Naviera | Agente / Naviera (tarifa vinculada) | → |
| 20 | — | Tránsito (días) | Tránsito | Tiempo de tránsito | → |
| 21 | — | — | Frecuencia | Frecuencia | → |
| 22 | — | Vigencia de la opción | Vigente hasta | Validez de la propuesta | → |
| 23 | — | O/F, origen, recolección, otros | Flete + cargos FOB/locales | Conceptos de venta/costo | → |
| 24 | — | Carta garantía | Carta garantía | Carta garantía | → |
| 25 | — | — | — | Seguro | se captura aquí |
| **Notas** | | | | | |
| 26 | Notas importantes | Notas | Notas | Notas internas | → |
| 27 | Archivos adjuntos | — | — | — | queda en la solicitud |
| 28 | — | — | — | Notas para el cliente (PDF) | — |

## 2. Reglas de la solicitud de pricing (Pasos 2–3)
- Obligatorios al enviar todo excepto: Notas, Delivery, Fecha tentativa y Adjuntos. El borrador se guarda incompleto.
- Agregar adjuntos a la solicitud.
- Las coincidencias del tarifario siguen disponibles para cotizar aunque se envíe la solicitud.
- Al enviar, el tipo se calcula solo: "Nuevas tarifas con otros agentes" (había coincidencias) o "Nueva ruta sin agentes" (no había).
- Complejidad automática y plazo:
  - Cotización estándar (tarifa del tarifario): sin contador.
  - Nueva ruta/agente/Incoterm: 36 h.
  - Especial/proyecto/multimodal (contenedor especial, proyecto, IMO, despacho aduanal): 48 h.
- Gerente de operaciones puede cambiar complejidad (con justificación obligatoria) y, en especiales, ampliar el plazo dentro de las primeras 8 h (con justificación). Avisa al solicitante y administradores.
- Notificación al ejecutivo de pricing y gerente de operaciones al enviar; indicador "Atrasada" al vencer.
- Se pueden mandar más opciones aunque ya esté respondida; todas se suman a la lista para cotizar.

## 3. Reglas de la cotización (Paso 4)
- Cliente general: exige oportunidad "En cotización" (no aplica a especiales).
- Prospecto: solo guardar borrador + botón "Pedir alta como cliente" que avisa a contabilidad y administradores.
- Envío exige autorización de admin/gerente comercial, verificando margen mínimo (ya existe; se alinea el estado "Por autorizar").
- Rechazada → copia controlada (ya existe; se verifica).

## 4. Clientes especiales (Nuevo tarifario)
- Botón "Cotizar y guardar tarifa" en el formulario de tarifa, habilitado solo si el cliente elegido es especial, para coordinador/gerente de operaciones.
- Guarda la tarifa y abre la cotización con la tarifa vinculada y los datos de la tabla precargados.

## 5. Handover (nuevo, mínimo)
- Al autorizar la cotización se crea el handover y se asigna un coordinador logístico por turno (round robin); si solo hay uno, a él.
- Notificación al coordinador y al gerente de operaciones con la ficha: datos del cliente, carga, cotización, agente y costo/venta.
- Campos nuevos: en oportunidad "¿Cliente FK?", "¿Carga consolidada?", "No. de bultos"; en cliente contactos de "Operaciones" y "Cuentas por pagar" (el crédito ya existe).

## Orden de entrega
1. Alineación de campos y migración automática (sección 1) + campos nuevos.
2. Reglas de solicitud, complejidad, plazos y notificaciones.
3. Reglas de cotización (prospecto, autorización).
4. Botón de clientes especiales.
5. Handover.

## Detalles técnicos
- Nuevas columnas en `crm_solicitudes_pricing`: `tipo_operacion`, `sector_economico`, `tipo_solicitud`, `complejidad_motivo`, `plazo_horas`, `plazo_motivo`, adjuntos (bucket con RLS por org vía EXISTS).
- Nuevas columnas en `crm_oportunidades`: `es_cliente_fk`, `carga_consolidada`, `num_bultos`; contactos por tipo reutilizando `contactos_cliente.tipo`.
- Mapeo en un solo módulo puro `mapeoSolicitudCotizacion.ts` (ampliar `aplicarTarifaAlForm`) con pruebas por campo.
- Complejidad/plazo calculados en trigger; cambios del gerente por RPC con justificación y notificación en `crm_notificaciones`.
- Handover: tabla `handovers` (cotización, coordinador, asignado_en) + RPC de asignación con bloqueo para round robin; disparado al autorizar.
- Cada fase: migración vía herramienta nativa, `db:postcheck`, pruebas focalizadas; CI/RLS completos en GitHub Actions. Sin publicar.

## Dudas a confirmar
- ¿"Cliente FK" significa cliente con freight forwarder propio / cuenta de otro forwarder?
- ¿"Tipo de operación" es Importación/Exportación o también Nacional?
- ¿El handover debe crear el embarque en Borrador o solo notificar con la ficha?

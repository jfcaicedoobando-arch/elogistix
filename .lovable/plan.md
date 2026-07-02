# Plan: Envío, aceptación y rechazo de proformas

Reutilizamos el patrón ya probado del módulo Cotizaciones (email branded + portal del cliente + aceptar/rechazar) y lo aplicamos a Proformas, agregando además un fallback manual para el equipo contable dentro de la página de la proforma. Al final, sólo una proforma **aceptada por el cliente** (o marcada manualmente como aceptada) puede convertirse en factura.

## 1. Modelo de datos (una migración)

Agregar a `public.proformas`:

- `estado_cliente` text — `pendiente` (default), `aceptada`, `rechazada`.
- `aceptada_at` / `rechazada_at` timestamptz.
- `aceptada_por` text (email del contacto o `manual:<user_id>`).
- `motivo_rechazo` text.
- `enviada_at` timestamptz, `enviada_por` uuid, `ultimo_envio_email` text.

Nueva tabla `proforma_envios` (espejo de `cotizacion_envios`): id, proforma_id, destinatarios[], cc[], asunto, mensaje, enviada_at, enviada_por, snapshot_totales jsonb. RLS por `organization_id` + GRANT a `authenticated` y `service_role`.

Regla de negocio: `convertir_proformas_a_factura` valida que **todas** las proformas del array tengan `estado_cliente = 'aceptada'` **y** `estado_revision = 'aprobada'`; si no, aborta con mensaje claro.

## 2. Envío por email (modal en la página de la proforma)

Componente `EnviarProformaDialog.tsx` calcado de `EnviarCotizacionDialog`:

- `DestinatariosPicker` con contactos del cliente + emails manuales, CC (usuario actual).
- Asunto/mensaje editables con plantilla (folio, cliente, totales MXN/USD).
- Edge Function nueva `enviar-proforma-email` (basada en `enviar-cotizacion-email`): genera PDF con `proformaPdf.tsx`, envía por Lovable Emails, registra fila en `proforma_envios`, marca `enviada_at`/`ultimo_envio_email`. Idempotencia por `proforma_id + destinatarios_hash`.
- El correo incluye un botón **"Revisar en el portal"** con link firmado al portal del cliente.

## 3. Portal del cliente: aceptar / rechazar

Nuevas rutas dentro de `portalRoutes.tsx`:

- `/portal/proformas` — lista de proformas visibles del cliente (RLS por `cliente_id` vinculado al usuario portal).
- `/portal/proformas/:id` — detalle con PDF embebido y dos acciones:
  - **Aceptar proforma** → confirma en modal, escribe `estado_cliente='aceptada'`, `aceptada_at=now()`, `aceptada_por=<email>`.
  - **Rechazar proforma** → pide motivo obligatorio, escribe `estado_cliente='rechazada'` + `motivo_rechazo`.
- RPC `portal_actualizar_estado_proforma(p_id, p_accion, p_motivo)` con `SECURITY DEFINER` que valida que el usuario autenticado esté ligado al `cliente_id` de la proforma (mismo patrón que las RPCs de cotizaciones del portal).
- Ambas acciones registran en `bitacora_actividad` y disparan `notificar-respuesta-proforma` (Edge Function) que avisa al operador y a contabilidad vía notificación interna + email.

## 4. Fallback manual para contabilidad

En `ProformaDetalle.tsx`, dentro de `AccionesProforma`, agregar bloque **"Estado del cliente"** visible sólo para roles `admin_org`, `contador`, `admin`, `super_admin`:

- Badge del `estado_cliente` actual.
- Botones **"Marcar como aceptada por el cliente"** y **"Marcar como rechazada"** (con motivo obligatorio).
- Requiere doble confirmación (`AlertDialog`) y deja rastro: `aceptada_por='manual:<user_id>'` + entrada en bitácora con contexto (por qué fue manual, ej. "cliente confirmó por WhatsApp").
- Sólo disponible cuando `estado_cliente = 'pendiente'`.

## 5. Bloqueo de conversión a factura

- `ConvertirAFacturaDialog` deshabilita el botón "Generar factura borrador" cuando alguna proforma seleccionada tiene `estado_cliente != 'aceptada'`, mostrando `Alert` explicativo.
- `fetchProformasPorFacturar` (bandeja "Por Timbrar") filtra por `estado_revision='aprobada' AND estado_cliente='aceptada'`. Las que estén aceptadas pero sin aprobación interna siguen apareciendo en el flujo actual de aprobación.
- El RPC valida server-side (defensa en profundidad).

## 6. Visualización

- `EstadoBadges` en `ProformaDetalleCards.tsx` gana un tercer badge (Cliente: Pendiente/Aceptada/Rechazada) con colores warning/success/destructive.
- En la lista `/proformas` agregar columna "Cliente" con el mismo badge y filtro rápido.
- Timeline compacto arriba: Enviada → Aceptada/Rechazada → Aprobada internamente → Facturada.

## 7. Detalles técnicos

- **Roles**: envío lo pueden disparar `operador`, `admin_org`, `contador`, `admin`. Aceptación manual sólo `admin_org`, `contador`, `admin`, `super_admin`.
- **RLS**: policies nuevas para portal (`cliente_id` = `client_users.cliente_id` del `auth.uid()`). GRANT a `anon` NO — sólo `authenticated`.
- **Edge Functions**: reutilizar helpers `wrapEdgeHandler` + `authenticateRequest` ya estándar. Deploy explícito de `enviar-proforma-email` y `notificar-respuesta-proforma`.
- **Tests**: unit tests para RPC (aceptación/rechazo/permiso), test de arquitectura para nuevos componentes ≤200 líneas, test de que `ConvertirAFacturaDialog` bloquea proformas no aceptadas, test del edge de idempotencia.
- **PDF**: si no existe todavía, generar snapshot del PDF al enviar y guardarlo en Storage (`proformas/<id>/<envio_id>.pdf`) para que el link del portal siga funcionando aunque cambien los conceptos.

## Estructura visual

```text
Proforma detalle
├── Header (folio, badges Revisión + Cliente + Facturada)
├── Timeline: Enviada → Respuesta cliente → Aprobada → Facturada
├── Acciones
│   ├── Descargar PDF
│   ├── Enviar por email  ◀ nuevo
│   ├── Marcar aceptada/rechazada manual  ◀ nuevo (solo contab.)
│   └── Convertir a factura (bloqueado si no aceptada)
└── Datos + Conceptos + Totales
```

## Alcance excluido (para no explotar el PR)

- Firma electrónica del cliente (sólo click "Aceptar").
- Recordatorios automáticos (se puede dejar para siguiente iteración).
- Aceptación parcial de conceptos: se acepta la proforma completa o se rechaza.

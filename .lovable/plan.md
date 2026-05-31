# Fase 4 — Acuse in-app al cliente en el portal (Brecha 4)

## Contexto

Brechas restantes del flujo de aceptación:

| # | Brecha | Estado | Acción esta fase |
|---|---|---|---|
| 1 (email) | Email a operaciones | 🟡 Código listo, bloqueado por dominio | Sin cambios |
| 4 | **Acuse al cliente** tras aceptar/rechazar | ❌ Pendiente | ✅ **Cerrar (in-app)** |
| 6 | Embarque borrador automático al aceptar | ❌ Pendiente | Requiere decisión de producto — fuera de alcance |

Hoy, cuando el cliente acepta o rechaza desde el portal, la UI invalida queries y el estado cambia, pero **no hay confirmación explícita persistente** de que su respuesta fue recibida. El cliente solo ve el badge cambiar. Esta fase añade un acuse **in-app** (sin email, ya que el dominio sigue pendiente).

## Alcance

### 1. Acuse inmediato en el diálogo (UX)

`PortalCotizacionConfirmDialog.tsx`:
- Tras éxito de la mutación, mostrar un estado de éxito en el propio diálogo (icono ✓, mensaje "Tu respuesta fue registrada. El equipo de Libre Carga ha sido notificado.") por ~2s antes de cerrar.
- Toast persistente (8s) con resumen: "Cotización #XXX aceptada el DD/MM/YYYY".
- En caso de rechazo, mensaje paralelo neutral.

### 2. Banner persistente en el detalle de la cotización (portal)

`PortalCotizacionDetalle.tsx` + nuevo `PortalCotizacionAcuseBanner.tsx`:
- Cuando `estado ∈ {Aceptada, Rechazada}`, renderizar un banner sobre el contenido con:
  - Icono + título ("Aceptaste esta cotización" / "Rechazaste esta cotización").
  - Fecha formateada `DD/MM/YYYY HH:mm` (usar `fecha_aceptacion`/`fecha_rechazo` cerrados en 12.26.0).
  - Si hay `comentario_cliente`, mostrarlo en blockquote.
  - Texto fijo: "El equipo de Libre Carga dará seguimiento y te avisará cuando tu embarque sea creado."
- Estilos con tokens semánticos (`bg-accent/10`, `border-accent`, etc.). Sin colores hardcodeados.

### 3. Listado del portal — indicador visual

`PortalCotizacionesList` (o equivalente, a ubicar en build mode):
- En la fila/card de cotizaciones `Aceptada`/`Rechazada`, mostrar fecha de respuesta junto al badge de estado, para reforzar que la acción quedó registrada.

### 4. Documentación

- `docs/flujo-aceptacion-cotizacion.md`:
  - Sección 7 — añadir fila "Cliente — acuse de aceptación / In-app → ✅ Sí (12.29.0)".
  - Sección 8 — Brecha 4 marcada como ✅ cerrada en 12.29.0 (in-app). El acuse por email queda explícitamente fuera (depende de dominio).
  - Sección 4 — paso 6 ampliado para mencionar banner persistente y toast.

### 5. Versión y changelog

- `src/constants/appVersion.ts` → `12.29.0`.
- `CHANGELOG.md` → entrada `[12.29.0] - 2026-05-31` con bullets:
  - Banner de acuse persistente en `/portal/cotizaciones/:id` para estados `Aceptada`/`Rechazada`.
  - Confirmación visual + toast tras responder.
  - Brecha 4 del flujo de aceptación cerrada (canal in-app).

## Lo que **NO** se hace en esta fase

- **No** se envía email al cliente (depende de dominio, queda como pendiente explícito).
- **No** se crea embarque borrador automático (Brecha 6, requiere decisión de producto — propongo abrirla en Fase 5 con `ask_questions`).
- **No** se toca la RPC ni triggers — todo es UI/presentación leyendo campos ya existentes (`fecha_aceptacion`, `fecha_rechazo`, `comentario_cliente`).

## Detalles técnicos

- **Sin migración**. Toda la información necesaria ya está en `cotizaciones` desde 12.26.0.
- **Componentes nuevos**: `PortalCotizacionAcuseBanner.tsx` (~80 líneas, presentacional puro).
- **Hooks**: ninguno nuevo; se consume `usePortalCotizacionDetalleController` existente.
- **i18n**: textos en es-MX, formato fecha `DD/MM/YYYY HH:mm` vía utilidades existentes.
- **Power of 10**: componente < 200 líneas, sin `any`, sin efectos, sin storage.

## Resultado esperado

- Cliente recibe confirmación clara y persistente de que su respuesta quedó registrada.
- Cero ambigüedad UX tras aceptar/rechazar.
- Brecha 4 cerrada en su canal in-app; el canal email queda documentado como pendiente del dominio.
- Solo queda Brecha 6 (embarque borrador automático), que abriré como decisión de producto en una siguiente fase.

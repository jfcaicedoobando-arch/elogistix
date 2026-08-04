# Plan R8 — FIX 1 (manejo de error/timeout) + 4 detalles menores

Base: `docs/auditoria/triage_uiux_r8.md` (v13.410.2). Sólo se ejecuta lo validado con evidencia.

## 1. FIX 1 — Rutas sin red de seguridad ante fallos

Hoy `AsyncBoundary` (timeout de 20 s + botón "Reintentar") sólo envuelve 6 pantallas: Tesorería, Cuentas de tesorería, Cartera, Configuración, Nuevo Embarque y Conciliación bancaria. Si la carga de datos falla o se queda colgada en el resto de las pantallas, el usuario ve un esqueleto gris para siempre, sin mensaje ni forma de reintentar.

Se envuelve el contenido de las rutas principales que hoy quedan sin protección:

- Embarques (listado) y Detalle de embarque
- Facturación (cockpit), Por emitir, Proformas, Cobranza, Antigüedad CxC, Comisiones
- Clientes, Proveedores
- Compras (CxP): Dashboard, Por capturar, Buzón de facturas, Por aprobar, Por pagar
- Cotizaciones (listado) y Detalle de cotización
- Gestión de Usuarios, CRM, Operaciones, Inicio (dashboard)

En cada una: mismo patrón ya usado en Tesorería (mensaje claro en español + "Reintentar"), sin tocar la lógica de negocio ni las consultas.

## 2. Detalles menores

1. **Badge de demora "0d"** en Alertas de Demora del dashboard: cuando son 0 días, mostrar "hoy" en lugar de "0d" (el número suelto no comunica nada).
2. **Glifos que no renderizan** (se ve un cuadro) en el saludo del dashboard y en el texto de ayuda del tab Tracking: se quitan esos emojis y, donde aporten, se sustituyen por iconos del sistema de diseño.
3. **Etiqueta "Por cobrar" duplicada** en Facturación (aparece como tarjeta KPI y como pestaña): se renombra la tarjeta a "Saldo por cobrar" para distinguirla de la pestaña.
4. **KPIs "Facturado mes" / "Cobrado mes" en MXN 0**: revisado contra la base — es dato correcto, no hay facturas emitidas en agosto 2026 (la última actividad es julio). No es un bug; sólo se aclara la etiqueta con el mes en curso (ej. "Facturado en agosto") para que el cero se entienda.

## Detalles técnicos

- Reutilizar `src/components/shared/states/AsyncBoundary.tsx` tal cual; no se crean variantes ni se cambia el timeout de 20 s.
- Envolver el árbol de contenido dentro de cada ruta (no el layout global) para que el sidebar y el header sigan usables cuando falle un panel.
- Los KPIs de Facturación vienen de la RPC `dashboard_facturacion_kpis`, que ancla el mes en curso a CDMX; no se modifica la RPC ni la política de conversión de moneda.
- Cambios sólo en componentes de presentación. Cero migraciones de base de datos.
- Respetar los límites de arquitectura (archivos ≤200 líneas): si envolver una ruta la pasa del límite, se extrae el contenido a un subcomponente.
- Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION` a `13.411.0`.

## Verificación

- Recorrido con Playwright a 1920x1080 de las rutas modificadas: cargan igual que hoy y no aparecen errores en consola.
- Prueba de fallo forzado (bloqueando las peticiones al backend) en al menos dos rutas nuevas: debe verse el mensaje de error con "Reintentar", no un esqueleto infinito.
- Suite de tests y validaciones de arquitectura en verde.
